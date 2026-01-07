'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
// 공통 이미지 처리 유틸리티 import
import { getSafeImageUrl, getDefaultImage, handleImageError } from '@/lib/imageUtils';
import { PageContainer, Button } from '../components/layout';
import { FiPlus, FiTrendingUp, FiClock, FiZap, FiPlayCircle, FiSettings, FiUser, FiLoader, FiChevronDown, FiActivity } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Vercel 빌드 최적화를 위한 메타데이터 - 클라이언트 컴포넌트에서는 제거
import { API_KEYS, MAP_CONFIG } from '../../config';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { hapticFeedback } from '@/utils/haptic';
import GroupSelector from '../../components/location/GroupSelector';
import memberService from '@/services/memberService';
import { hasLocationAndActivityPermissions, requestLocationAndActivityPermissions } from '@/utils/androidPermissions';
import { cubicBezier } from 'framer-motion';

// Dynamic Imports for better code splitting
const AnimatedHeader = dynamic(() => import('../../components/common/AnimatedHeader'), {
  loading: () => (
    <div className="h-[62px] bg-gradient-to-r from-[#667eea] to-[#764ba2] animate-pulse" />
  ),
  ssr: false
});

const DebugPanel = dynamic(() => import('../components/layout/DebugPanel'), {
  loading: () => (
    <div className="fixed bottom-4 right-4 w-48 h-32 bg-gray-100 rounded-lg animate-pulse" />
  ),
  ssr: false
});

const LogParser = dynamic(() => import('../components/layout/LogParser'), {
  loading: () => (
    <div className="w-full h-24 bg-gray-100 rounded-lg animate-pulse" />
  ),
  ssr: false
});

const MemberCalendar = dynamic(() => import('../../components/activelog/MemberCalendar'), {
  loading: () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-lg animate-pulse">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    </div>
  ),
  ssr: false
});

const LocationSummaryCard = dynamic(() => import('../../components/activelog/LocationSummaryCard'), {
  loading: () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((index) => (
          <div key={index} className="text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  ),
  ssr: false
});

// GroupSelector는 상단에서 일반 임포트로 변경됨

import groupService, { Group } from '@/services/groupService';
import memberLocationLogService, { LocationLog, LocationSummary as APILocationSummary, LocationPathData, DailySummary, StayTime, MapMarker, LocationLogSummary, DailyCountsResponse, MemberActivityResponse, MemberDailyCount } from '@/services/memberLocationLogService';
import ErrorDisplay from './components/ErrorDisplay';
import ErrorToast from './components/ErrorToast';
import { MapSkeleton } from '@/components/common/MapSkeleton';
import InitialLoadingOverlay from './components/InitialLoadingOverlay';
import FloatingButton from '../../components/common/FloatingButton';

import { retryDataFetch, retryMapApiLoad, retryMapInitialization } from '@/utils/retryUtils';

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
    gradientPolylines?: any[];
    getRecentDaysDebugLogged?: boolean;
    // google: any; // google은 activelog 페이지에서 아직 사용하지 않으므로 주석 처리 또는 필요시 추가
  }
}

const NAVER_MAPS_CLIENT_ID = API_KEYS.NAVER_MAPS_CLIENT_ID;

// --- home/page.tsx에서 가져온 인터페이스 및 데이터 시작 ---
interface Location { // home/page.tsx의 Location 인터페이스 (필요시 activelog의 기존 LocationData와 병합/조정)
  lat: number;
  lng: number;
}



interface GroupMember {
  id: string; name: string; photo: string | null; mt_file1?: string | null; isSelected: boolean; location: Location;
  mt_gender?: number | null; original_index: number;
  mt_weather_sky?: string | number | null; mt_weather_tmx?: string | number | null;
  mt_weather_tmn?: string | number | null; mt_weather_date?: string | null;
  mlt_lat?: number | null; mlt_long?: number | null; mlt_speed?: number | null;
  mlt_battery?: number | null; mlt_gps_time?: string | null;
  sgdt_owner_chk?: string; sgdt_leader_chk?: string;
  sgdt_idx?: number; // 그룹 상세 인덱스 추가
}


// --- home/page.tsx에서 가져온 인터페이스 및 데이터 끝 ---

// 위치기록 요약 데이터 인터페이스 (UI용)
interface LocationSummary {
  distance: string;
  time: string;
  steps: string;
}

// 기본 위치기록 요약 데이터
const DEFAULT_LOCATION_SUMMARY: LocationSummary = {
  distance: '0 km',
  time: '0분',
  steps: '0 걸음',
};

// 모의 로그 데이터 - 날짜를 최근으로 업데이트
const MOCK_LOGS = [
  {
    id: '1',
    type: 'schedule',
    action: 'create',
    title: '팀 미팅 일정이 생성되었습니다.',
    description: '오늘 오후 2시 - 강남 사무실',
    user: '김철수',
    timestamp: format(new Date(), 'yyyy-MM-dd') + 'T14:32:00',
  },
  {
    id: '2',
    type: 'location',
    action: 'update',
    title: '장소 정보가 업데이트되었습니다.',
    description: '강남 사무실 - 주소 변경',
    user: '이영희',
    timestamp: format(subDays(new Date(), 1), 'yyyy-MM-dd') + 'T11:15:00',
  },
  {
    id: '3',
    type: 'group',
    action: 'add_member',
    title: '그룹원이 추가되었습니다.',
    description: '개발팀 - 박지민 추가',
    user: '김철수',
    timestamp: format(subDays(new Date(), 2), 'yyyy-MM-dd') + 'T16:45:00',
  },
  {
    id: '4',
    type: 'schedule',
    action: 'delete',
    title: '일정이 취소되었습니다.',
    description: '프로젝트 중간점검 - 취소',
    user: '이영희',
    timestamp: format(subDays(new Date(), 3), 'yyyy-MM-dd') + 'T09:20:00',
  },
  {
    id: '5',
    type: 'location',
    action: 'create',
    title: '새 장소가 등록되었습니다.',
    description: '을지로 오피스 - 추가됨',
    user: '김철수',
    timestamp: format(subDays(new Date(), 5), 'yyyy-MM-dd') + 'T13:10:00',
  },
  {
    id: '6',
    type: 'group',
    action: 'remove_member',
    title: '그룹원이 제거되었습니다.',
    description: '마케팅팀 - 홍길동 제거',
    user: '정민지',
    timestamp: format(subDays(new Date(), 7), 'yyyy-MM-dd') + 'T15:30:00',
  },
  {
    id: '7',
    type: 'schedule',
    action: 'update',
    title: '일정이 수정되었습니다.',
    description: '고객 미팅 - 시간 변경',
    user: '이영희',
    timestamp: format(subDays(new Date(), 10), 'yyyy-MM-dd') + 'T10:25:00',
  }
];

// 최적화된 애니메이션 variants - 순차적이고 부드러운 애니메이션 (location/group과 동일한 패턴)
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

// 지도 컨테이너 애니메이션
const mapContainerVariants = {
  initial: {
    opacity: 0,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      delay: 0.3
    }
  }
};

// 플로팅 카드 애니메이션 - 지도 다음
const floatingCardVariants = {
  initial: {
    opacity: 0,
    y: -30,
    scale: 0.9
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      delay: 0.6
    }
  },
  exit: {
    opacity: 0,
    y: -30,
    scale: 0.9,
    transition: {
      duration: 0.3
    }
  }
};

// 사이드바 애니메이션 - 안정적인 애니메이션
const sidebarVariants = {
  closed: {
    x: -30,
    opacity: 0,
    scale: 0.99,
    filter: 'blur(1px)',
    boxShadow: '0 0 0 rgba(0,0,0,0)',
    transition: { duration: 0.7 }
  },
  open: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    boxShadow: '0 8px 32px rgba(31,41,55,0.18), 0 1.5px 6px rgba(0,0,0,0.08)',
    transition: { duration: 0.8 }
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

// 멤버 아이템 애니메이션 - 간단한 슬라이딩 애니메이션
const memberItemVariants = {
  closed: {
    opacity: 1
  },
  open: {
    opacity: 1
  }
};



const pageStyles = `
/* 앱 고정 레이아웃 - 전체 스크롤 비활성화 */
html, body {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
  overscroll-behavior: contain !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  -khtml-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
}

/* 사이드바 열린 상태에서 전체 스크롤 완전 차단 */
body.sidebar-open {
  overflow: hidden !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  touch-action: none !important;
  -webkit-overflow-scrolling: auto !important;
}

/* 사이드바 내부는 클릭과 스크롤 허용 */
body.sidebar-open .sidebar-content {
  touch-action: auto !important;
  pointer-events: auto !important;
}

body.sidebar-open .sidebar-content * {
  touch-action: auto !important;
  pointer-events: auto !important;
}

/* 최적화된 애니메이션 */
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-slideUp {
  animation: slideUp 0.6s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

/* 하드웨어 가속 최적화 */
.hardware-accelerated {
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  perspective: 1000px;
  -webkit-perspective: 1000px;
}

/* glass-effect 스타일 추가 */
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  position: fixed !important;
  z-index: 9999 !important;
  min-height: unset !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* 안드로이드 환경 최적화 */
@media screen and (-webkit-device-pixel-ratio: 1),
       screen and (-webkit-device-pixel-ratio: 1.5),
       screen and (-webkit-device-pixel-ratio: 2),
       screen and (-webkit-device-pixel-ratio: 3) {
  /* 안드로이드 기기만 감지 (iOS 제외) */
  @supports not (-webkit-appearance: none) {
    .header-fixed {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      padding-top: 0px !important;
      min-height: 64px !important;
      height: auto !important;
      z-index: 999999 !important;
      will-change: transform !important;
      -webkit-transform: translateZ(0) !important;
      transform: translateZ(0) !important;
      -webkit-backface-visibility: hidden !important;
      backface-visibility: hidden !important;
    }
    
    /* 안드로이드에서만 지도 컨테이너 상단 마진 증가 */
    .full-map-container {
      padding-top: 72px !important;
    }
  }
}

/* 안드로이드 Chrome WebView 최적화 */
@supports (-webkit-appearance: none) {
  .header-fixed {
    -webkit-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
    touch-action: manipulation !important;
  }
}

.full-map-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* 콘텐츠 섹션 스타일 - home/page.tsx에서 가져옴 */
.content-section {
  margin-bottom: 20px;
}

.content-section.members-section {
  margin-bottom: 12px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 12px;
}

/* home/page.tsx에서 가져온 추가 섹션 스타일 */
.members-section {
  background: linear-gradient(to right, #eef2ff, #faf5ff) !important;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 16px;
  padding: 16px;
}

.summary-section {
  background: linear-gradient(135deg, #fdf2f8 0%, #fef7f0 100%);
  border: 1px solid rgba(244, 114, 182, 0.2);
  border-radius: 16px;
  padding: 16px;
}

  .activelog-section {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 16px;
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.section-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 4px;
}

/* mobile-button 클래스 추가 */
.mobile-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

/* w-13 h-13 클래스 정의 (52px) */
.w-13 {
  width: 3.25rem; /* 52px */
}

.h-13 {
  height: 3.25rem; /* 52px */
}

/* member-avatar 스타일 */
.member-avatar {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.member-avatar.selected {
  box-shadow: 0 0 0 3px #6366f1, 0 0 20px rgba(99, 102, 241, 0.4);
}

/* 그룹 선택 드롭다운 스타일 */
.group-selector {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.group-selector:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

/* 경로 따라가기 컨트롤 버튼 위치 */
  .activelog-control-buttons {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
}



/* 이미지 로딩 최적화 */
.member-image {
  transition: opacity 0.3s ease;
}

.member-image.loading {
  opacity: 0.7;
}

.member-image.loaded {
  opacity: 1;
}

/* 성능 최적화 */
.will-change-transform {
  will-change: transform;
}

.will-change-opacity {
  will-change: opacity;
}

/* 앱 고정 레이아웃 - 전체 스크롤 비활성화 */
html, body {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: manipulation !important;
}

/* 모바일 사파리 bounce 효과 비활성화 */
body {
  overscroll-behavior: none !important;
  -webkit-overflow-scrolling: touch !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  outline: 0 !important;
}

/* 모바일 앱 최적화 */
* {
  -webkit-tap-highlight-color: transparent !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

/* 터치 최적화 */
.touch-optimized {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

@media (max-width: 640px) {
  .member-avatar {
    width: 48px; 
    height: 48px; 
  }
}

/* 접근성 개선 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

// 백엔드 이미지 저장 경로의 기본 URL


// 애니메이션 variants 추가 (home/page.tsx에서 가져옴)
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

const loadingVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const loadingTextVariants = {
  hidden: {
    opacity: 0,
    y: 10
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

// 이미지 처리 함수들은 @/lib/imageUtils에서 import하여 사용

// 색상 보간 함수
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  // 16진수 색상을 RGB로 변환
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substr(0, 2), 16);
  const g1 = parseInt(hex1.substr(2, 2), 16);
  const b1 = parseInt(hex1.substr(4, 2), 16);

  const r2 = parseInt(hex2.substr(0, 2), 16);
  const g2 = parseInt(hex2.substr(2, 2), 16);
  const b2 = parseInt(hex2.substr(4, 2), 16);

  // 보간 계산
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  // RGB를 16진수로 변환
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// 멤버 목록 정렬 함수: 오너 > 리더 > mt_idx 순서
const sortGroupMembers = (members: GroupMember[]): GroupMember[] => {
  return [...members].sort((a, b) => {
    // 1. 오너가 최우선
    if (a.sgdt_owner_chk === 'Y' && b.sgdt_owner_chk !== 'Y') return -1;
    if (b.sgdt_owner_chk === 'Y' && a.sgdt_owner_chk !== 'Y') return 1;

    // 2. 리더가 두 번째 우선순위 (오너가 아닌 경우)
    if (a.sgdt_owner_chk !== 'Y' && b.sgdt_owner_chk !== 'Y') {
      if (a.sgdt_leader_chk === 'Y' && b.sgdt_leader_chk !== 'Y') return -1;
      if (b.sgdt_leader_chk === 'Y' && a.sgdt_leader_chk !== 'Y') return 1;
    }

    // 3. 같은 권한 레벨이면 mt_idx(id를 숫자로 변환) 순서로 정렬
    const aId = parseInt(a.id) || 0;
    const bId = parseInt(b.id) || 0;
    return aId - bId;
  });
};



// 전역 실행 제어 - 한 번만 실행되도록 보장
let globalPageExecuted = false;
let globalComponentInstances = 0;

export default function ActivelogPage() {
  const router = useRouter();

  // Vercel 환경 감지
  const isVercel = typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('nextstep.smap.site'));

  // 인증 관련 상태 추가 (home/page.tsx와 동일)
  const { user, isLoggedIn = false, loading: authLoading = false } = useAuth() || {};
  // UserContext 사용
  const { userInfo, userGroups, isUserDataLoading = false, userDataError, refreshUserData } = useUser() || {};
  // DataCacheContext 사용 - ACTIVELOG 페이지에서는 캐시 비활성화
  const {
    getGroupMembers: getCachedGroupMembers,
    setGroupMembers: setCachedGroupMembers,
    getLocationData: getCachedLocationData,
    setLocationData: setCachedLocationData,
    getDailyLocationCounts: getCachedDailyLocationCounts,
    setDailyLocationCounts: setCachedDailyLocationCounts,
    isCacheValid,
    invalidateCache
  } = useDataCache();

  // ACTIVELOG 페이지 전용 캐시 비활성화 설정
  const DISABLE_CACHE = true;

  // home/page.tsx와 동일한 상태들 추가
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);
  const [isGroupMemberCountsLoaded, setIsGroupMemberCountsLoaded] = useState(false); // 그룹 멤버 수 로딩 완료 상태


  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // 데이터 fetch 상태 관리
  const dataFetchedRef = useRef<{ members: boolean; dailyCounts: boolean }>({ members: false, dailyCounts: false });

  // 컴포넌트 인스턴스별 실행 제어
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const hasExecuted = useRef(false);
  const isMainInstance = useRef(false);

  // 🔥 활동로그 페이지 진입 시 권한 체크
  useEffect(() => {
    const checkActivityPermissions = async () => {
      console.log('🔥 [ACTIVELOG_PAGE] 동작/위치 권한 체크 시작');

      if (!hasLocationAndActivityPermissions()) {
        console.log('⚠️ [ACTIVELOG_PAGE] 위치/동작 권한이 없음 - 요청');
        try {
          const granted = await requestLocationAndActivityPermissions();
          if (granted) {
            console.log('✅ [ACTIVELOG_PAGE] 위치/동작 권한 요청 성공');
          } else {
            console.log('⚠️ [ACTIVELOG_PAGE] 위치/동작 권한 요청 실패');
          }
        } catch (error) {
          console.error('❌ [ACTIVELOG_PAGE] 위치/동작 권한 요청 중 오류:', error);
        }
      } else {
        console.log('✅ [ACTIVELOG_PAGE] 위치/동작 권한 이미 허용됨');
      }
    };

    // 페이지 로드 후 1초 뒤에 권한 체크
    const timeoutId = setTimeout(checkActivityPermissions, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  // WebKit 환경에서 안정적인 금일 날짜 생성
  const getTodayDateString = useCallback(() => {
    const now = new Date();

    // WebKit 환경 확인 (타입스크립트 오류 방지를 위해 window 체크)
    const webkit = typeof window !== 'undefined' && (!!(window as any).webkit || navigator.userAgent.includes('WebKit'));

    // WebKit 환경에서 타임존 처리 보정
    if (webkit) {
      // 로컬 타임존 기준으로 명시적 계산
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;

      console.log('[getTodayDateString] WebKit 환경 금일 날짜:', {
        originalDate: now.toISOString(),
        localDate: now.toLocaleDateString(),
        calculatedToday: todayString,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      return todayString;
    }

    // 일반 환경에서는 기존 방식
    return format(now, 'yyyy-MM-dd');
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // 초기 렌더링에서는 기본값 사용, useEffect에서 정확한 날짜로 업데이트
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [previousDate, setPreviousDate] = useState<string | null>(null); // 이전 날짜 추적
  const isDateChangedRef = useRef<boolean>(false); // 날짜 변경 플래그
  const isUserDateSelectionRef = useRef<boolean>(false); // 사용자가 직접 날짜를 선택했는지 추적
  const loadLocationDataExecutingRef = useRef<{ executing: boolean; lastExecution?: number; currentRequest?: string; cancelled?: boolean }>({ executing: false }); // loadLocationData 중복 실행 방지

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const memberNaverMarkers = useRef<any[]>([]);
  const locationLogMarkers = useRef<any[]>([]); // 위치 로그 마커들을 위한 ref
  const locationLogPolyline = useRef<any>(null); // 위치 로그 연결선을 위한 ref
  const startEndMarkers = useRef<any[]>([]); // 시작/종료 마커들을 위한 ref
  const stayTimeMarkers = useRef<any[]>([]); // 체류시간 마커들을 위한 ref
  const arrowMarkers = useRef<any[]>([]); // 화살표 마커들 저장할 배열 추가
  const currentPositionMarker = useRef<any>(null); // 슬라이더 현재 위치 마커를 위한 ref
  const sliderRef = useRef<HTMLDivElement>(null); // 슬라이더 요소를 위한 ref
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isWaitingForMembers, setIsWaitingForMembers] = useState(true);
  const [isMapInitializedActivelog, setIsMapInitializedActivelog] = useState(false); // Activelog 페이지용 지도 초기화 상태
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false); // 초기 데이터 로딩 상태 추가

  // 포괄적인 초기 로딩 상태 관리 추가
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<'maps' | 'groups' | 'members' | 'data' | 'complete'>('maps');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hasInitialLoadFailed, setHasInitialLoadFailed] = useState(false);

  // 로딩 단계/진행률 단조 증가 보장 유틸리티
  const loadingStepOrder: Record<typeof loadingStep, number> = {
    maps: 1,
    groups: 2,
    members: 3,
    data: 4,
    complete: 5,
  } as const;
  const updateLoadingStepSafe = (nextStep: typeof loadingStep) => {
    setLoadingStep((prev) => (loadingStepOrder[nextStep] > loadingStepOrder[prev] ? nextStep : prev));
  };
  const updateLoadingProgressSafe = (next: number) => {
    setLoadingProgress((prev) => (next > prev ? next : prev));
  };

  // 첫 진입 애니메이션 상태 관리

  const [showDateSelection, setShowDateSelection] = useState(false);

  // home/page.tsx와 동일한 바텀시트 상태 관리

  const startDragY = useRef<number | null>(null);
  const startDragX = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const hasUserInteracted = useRef<boolean>(false); // 사용자 상호작용 추적

  // 로그 페이지 뷰 상태 - 이제 summary만 사용
  const [activeLogView, setActiveLogView] = useState<'summary'>('summary');

  // 사이드바 상태 추가
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 사이드바 열릴 때 전체 스크롤 완전 차단 (CSS만 사용)
  useEffect(() => {
    if (isSidebarOpen) {
      // body에 sidebar-open 클래스 추가 (CSS로 스크롤 차단)
      document.body.classList.add('sidebar-open');
      console.log('[LOGS] 사이드바 열림 - CSS 스크롤 차단');

      return () => {
        // body에서 sidebar-open 클래스 제거
        document.body.classList.remove('sidebar-open');
        console.log('[LOGS] 사이드바 닫힘 - 스크롤 상태 복원');
      };
    }
  }, [isSidebarOpen]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 사이드바 날짜 스크롤 관련 상태 추가
  const sidebarDateX = useMotionValue(0); // 사이드바 날짜 선택용 motionValue
  const sidebarDraggingRef = useRef(false); // 사이드바 드래그용 ref
  const lastScrolledIndexRef = useRef<number>(-1); // 마지막으로 스크롤한 날짜 인덱스 추적
  const lastLoadedMemberRef = useRef<string | null>(null); // 마지막으로 로딩된 멤버 ID 추적

  // activeLogView 변경 시 스와이프 컨테이너 스크롤 위치 조정 (초기 로드 시는 제외)
  useEffect(() => {
    // 초기 로드 시 자동 스크롤하지 않도록 제거 - 사용자 의도적인 뷰 변경 시에만 스크롤
  }, [activeLogView]);
  const [locationSummary, setLocationSummary] = useState<LocationSummary>(DEFAULT_LOCATION_SUMMARY);
  const [currentLocationLogs, setCurrentLocationLogs] = useState<LocationLog[]>([]);
  const [isLocationDataLoading, setIsLocationDataLoading] = useState(false);

  // 새로운 API 응답 상태 추가
  const [dailySummaryData, setDailySummaryData] = useState<DailySummary[]>([]);
  const [stayTimesData, setStayTimesData] = useState<StayTime[]>([]);
  const [mapMarkersData, setMapMarkersData] = useState<MapMarker[]>([]);
  const [locationLogSummaryData, setLocationLogSummaryData] = useState<LocationLogSummary | null>(null);

  // 날짜별 활동 로그 상태 추가
  const [dailyCountsData, setDailyCountsData] = useState<DailyCountsResponse | null>(null);
  const [memberActivityData, setMemberActivityData] = useState<MemberActivityResponse | null>(null);
  const [isDailyCountsLoading, setIsDailyCountsLoading] = useState(false);
  const [isMemberActivityLoading, setIsMemberActivityLoading] = useState(false);

  // WebKit 환경 감지 상태
  const [isWebKitEnv, setIsWebKitEnv] = useState(false);
  const [isIOSWebViewEnv, setIsIOSWebViewEnv] = useState(false);

  // 멤버별 로그 분포 상태 (14일간의 활동 여부)
  const [memberLogDistribution, setMemberLogDistribution] = useState<Record<string, boolean[]>>({});

  const [sliderValue, setSliderValue] = useState(0); // 슬라이더 초기 값 (0-100) - 시작은 0으로
  const [sortedLocationData, setSortedLocationData] = useState<MapMarker[]>([]); // 정렬된 위치 로그 데이터
  const [isSliderDragging, setIsSliderDragging] = useState(false); // 슬라이더 드래그 중인지 확인

  // 초기 진입 감지 플래그
  const [isInitialEntry, setIsInitialEntry] = useState(true);

  // 에러 상태 관리
  const [dataError, setDataError] = useState<{
    type: 'network' | 'server' | 'timeout' | 'data' | 'unknown';
    message: string;
    retryable: boolean;
    details?: any;
    timestamp?: string;
    context?: string;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const dateScrollContainerRef = useRef<HTMLDivElement>(null); // 날짜 스크롤 컨테이너 Ref 추가

  // 데이터 검증 및 재세팅 관련 상태 추가
  const [dataValidationState, setDataValidationState] = useState<{
    isValidating: boolean;
    lastValidationTime: number | null;
    validationErrors: string[];
    retryCount: number;
  }>({
    isValidating: false,
    lastValidationTime: null,
    validationErrors: [],
    retryCount: 0
  });

  // 메모이제이션된 계산 값들
  const selectedMember = useMemo(() => {
    return groupMembers.find(member => member.isSelected) || null;
  }, [groupMembers]);

  const selectedGroup = useMemo(() => {
    return userGroups.find(group => group.sgt_idx === selectedGroupId) || null;
  }, [userGroups, selectedGroupId]);

  const currentMonthData = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      firstDay: new Date(now.getFullYear(), now.getMonth(), 1),
      lastDay: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }, []);

  const isLoadingComplete = useMemo(() => {
    return !isLocationDataLoading && !isMapLoading && !isInitialLoading;
  }, [isLocationDataLoading, isMapLoading, isInitialLoading]);

  // 헤더 상단 패딩 강제 제거 (런타임)
  useEffect(() => {
    const forceRemoveHeaderPadding = () => {
      if (typeof document === 'undefined') return;

      // 모든 헤더 관련 요소 선택
      const selectors = [
        'header',
        '.header-fixed',
        '.glass-effect',
        '.activelog-header',
        '.register-header-fixed',
        '.group-header',
        '.location-header',
        '.schedule-header',
        '.home-header',
        '[role="banner"]',
        '#activelog-page-container'
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
    };

    // 즉시 실행
    forceRemoveHeaderPadding();

    // 정기적으로 강제 적용 (다른 스타일이 덮어쓸 수 있으므로)
    const interval = setInterval(forceRemoveHeaderPadding, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // WebKit 환경 감지 및 최적화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const webkit = !!(window as any).webkit || navigator.userAgent.includes('WebKit');
      const iosWebView = !!(window as any).webkit?.messageHandlers;

      setIsWebKitEnv(webkit);
      setIsIOSWebViewEnv(iosWebView);

      console.log('[LOGS PAGE] 환경 감지 완료:', {
        isWebKit: webkit,
        isIOSWebView: iosWebView,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown',
        deviceMemory: (navigator as any).deviceMemory || 'unknown'
      });

      // 환경 감지 후 초기 진입 시에만 금일 날짜로 업데이트 (사용자가 선택한 날짜는 유지)
      const accurateToday = getTodayDateString();
      const currentSelected = selectedDate;

      // 초기 진입 시에만 날짜 보정 (사용자가 의도적으로 선택한 날짜는 변경하지 않음)
      if (currentSelected !== accurateToday && isInitialEntry) {
        console.log('[LOGS PAGE] 초기 진입 시 금일 날짜 보정:', {
          기존: currentSelected,
          보정후: accurateToday,
          webkit,
          isInitialEntry
        });
        setSelectedDate(accurateToday);
      } else if (currentSelected !== accurateToday && !isInitialEntry) {
        console.log('[LOGS PAGE] 사용자가 선택한 날짜 유지:', {
          선택된날짜: currentSelected,
          오늘날짜: accurateToday,
          webkit,
          isInitialEntry
        });
      }

      // WebKit 환경에서 성능 최적화
      if (webkit) {
        console.log('[LOGS WEBKIT] WebKit 환경 최적화 적용');

        // iOS WebView에서 추가 최적화
        if (iosWebView) {
          console.log('[LOGS WEBKIT] iOS WebView 추가 최적화 적용');

          // iOS WebView에서 메모리 경고 리스너 추가
          window.addEventListener('pagehide', () => {
            console.log('[LOGS WEBKIT] 페이지 숨김 - 리소스 정리');
            // 지도 관련 리소스 정리
            if (map.current) {
              clearMapMarkersAndPaths(true, true, false);
            }
          });

          // iOS WebView에서 메모리 압박 시 캐시 정리
          if ('memory' in performance) {
            const checkMemory = () => {
              const memInfo = (performance as any).memory;
              if (memInfo && memInfo.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB 초과시
                console.log('[LOGS WEBKIT] 메모리 사용량 높음 - 캐시 정리');
                invalidateCache('memory-pressure');
              }
            };

            const memoryCheckInterval = setInterval(checkMemory, 30000); // 30초마다 체크
            return () => clearInterval(memoryCheckInterval);
          }
        }
      }
    }
  }, [getTodayDateString, isInitialEntry]);

  // 자정 넘어가면 금일 날짜 자동 업데이트
  useEffect(() => {
    const updateDateAtMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      const midnightTimer = setTimeout(() => {
        const newToday = getTodayDateString();
        const currentSelected = selectedDate;

        // 현재 선택된 날짜가 어제 날짜인 경우에만 금일로 업데이트
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = format(yesterday, 'yyyy-MM-dd');

        if (currentSelected === yesterdayString) {
          console.log('[LOGS PAGE] 자정 지남 - 금일 날짜로 자동 업데이트:', {
            기존: currentSelected,
            신규: newToday
          });
          setSelectedDate(newToday);

          // 캐시 정리 (어제 데이터는 유지하되 새로운 오늘 데이터를 위해 준비)
          console.log('[LOGS PAGE] 자정 업데이트 - 데이터 새로고침 준비');

          // 현재 선택된 멤버가 있으면 새로운 날짜로 데이터 재로딩
          const selectedMember = groupMembers.find(m => m.isSelected);
          if (selectedMember && selectedGroupId) {
            console.log('[LOGS PAGE] 자정 업데이트 - 선택된 멤버 데이터 재로딩:', selectedMember.name);
            // 간단한 새로고침 신호만 전송 (실제 로딩은 상태 변경으로 트리거)
            window.location.reload();
          }
        }

        // 다음 자정을 위한 재귀 설정
        updateDateAtMidnight();
      }, timeUntilMidnight);

      return () => clearTimeout(midnightTimer);
    };

    const cleanup = updateDateAtMidnight();
    return cleanup;
  }, [getTodayDateString, selectedDate, groupMembers, selectedGroupId]);

  // 에러 처리 헬퍼 함수
  const handleDataError = (error: any, context: string) => {
    const timestamp = new Date().toISOString();
    const isVercel = typeof window !== 'undefined' &&
      (window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('nextstep.smap.site'));

    console.error(`[${context}] 💥 데이터 로딩 오류 발생:`, {
      error,
      context,
      timestamp,
      userAgent: navigator.userAgent,
      isOnline: navigator.onLine,
      url: window.location.href,
      isVercel,
      selectedMember: groupMembers.find(m => m.isSelected)?.name,
      selectedDate,
      selectedGroupId
    });

    // 에러 타입 정확히 분류
    let errorType: 'network' | 'server' | 'timeout' | 'data' | 'unknown' = 'unknown';
    let errorMessage = '데이터를 불러오는 중 오류가 발생했습니다.';
    let retryable = true;
    let errorDetails: any = null;

    // 네트워크 연결 문제
    if (!navigator.onLine) {
      errorType = 'network';
      errorMessage = '인터넷 연결이 끊어졌습니다. 연결을 확인하고 다시 시도해주세요.';
      retryable = true;
    }
    // 타임아웃 오류
    else if (error?.message?.includes('타임아웃') || error?.message?.includes('timeout')) {
      errorType = 'timeout';
      errorMessage = '응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
      retryable = true;
    }
    // 서버 오류 (5xx)
    else if (error?.response?.status >= 500) {
      errorType = 'server';
      errorMessage = `서버 오류가 발생했습니다 (${error.response.status}). 잠시 후 다시 시도해주세요.`;
      retryable = true;
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }
    // 클라이언트 오류 (4xx)
    else if (error?.response?.status >= 400 && error?.response?.status < 500) {
      if (error.response.status === 404) {
        errorType = 'data';
        // 컨텍스트에 따라 다른 메시지 표시
        if (context.includes('멤버 조회') || context.includes('그룹')) {
          errorMessage = '그룹 정보를 찾을 수 없습니다. 다른 그룹을 선택해보세요.';
        } else {
          errorMessage = '요청한 데이터를 찾을 수 없습니다. 다른 날짜나 멤버를 선택해보세요.';
        }
        retryable = false;
      } else {
        errorType = 'data';
        errorMessage = `잘못된 요청입니다 (${error.response.status}). 다시 시도해주세요.`;
        retryable = true;
      }
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }
    // 네트워크 관련 오류
    else if (error?.code === 'NETWORK_ERROR' ||
      error?.message?.includes('network') ||
      error?.message?.includes('Network') ||
      error?.message?.includes('fetch') ||
      error?.message?.includes('핵심 API 호출이 모두 실패')) {
      errorType = 'network';
      // Vercel 환경에서는 더 구체적인 메시지 제공
      if (isVercel) {
        errorMessage = 'Vercel 환경에서 네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      } else {
        errorMessage = '네트워크 연결에 문제가 있습니다. 연결 상태를 확인하고 다시 시도해주세요.';
      }
      retryable = true;
    }
    // 기타 알 수 없는 오류
    else {
      errorType = 'unknown';
      errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
      retryable = true;
      errorDetails = {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      };
    }

    // 상세 정보 추가
    if (context.includes('retry-failed')) {
      errorMessage += ' 잠시 후 다시 시도해주세요.';
      retryable = false;
    }

    // 부분 실패인 경우 에러 메시지 완화
    if (context === 'loadLocationData' && !context.includes('retry-failed')) {
      errorMessage = '일부 데이터를 불러오지 못했지만 가능한 정보를 표시합니다.';
      retryable = true;
    }

    setDataError({
      type: errorType,
      message: errorMessage,
      retryable,
      details: errorDetails,
      timestamp,
      context
    });
  };

  // 재시도 함수
  const retryDataLoad = async () => {
    if (retryCount >= 2) { // maxRetries를 2로 축소
      console.log('[RETRY] 최대 재시도 횟수 초과');
      return;
    }

    console.log(`[RETRY] 수동 재시도 시작 (${retryCount + 1}/2)`);
    setRetryCount(prev => prev + 1);
    setDataError(null);
    setIsLocationDataLoading(true);

    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember && selectedDate) {
      console.log(`[RETRY] 데이터 재시도 (${retryCount + 1}/2):`, selectedMember.name, selectedDate);
      try {
        await loadLocationData(parseInt(selectedMember.id), selectedDate);
      } catch (retryError) {
        console.error('[RETRY] 수동 재시도 실패:', retryError);
        setIsLocationDataLoading(false);
      }
    } else {
      console.warn('[RETRY] 선택된 멤버 또는 날짜가 없어 재시도 불가');
      setIsLocationDataLoading(false);
    }
  };

  // 초기 로딩 완료 체크
  useEffect(() => {
    if (
      naverMapsLoaded &&
      isMapInitializedActivelog &&
      groupMembers.length > 0 &&
      loadingStep !== 'complete'
    ) {
      console.log('[LOGS] 모든 초기 로딩 완료');
      updateLoadingStepSafe('complete');
      updateLoadingProgressSafe(100);

      // 완료 후 조금의 딜레이를 두고 초기 로딩 상태 해제
      setTimeout(() => {
        setIsInitialLoading(false);
        setIsMapLoading(false);
        setIsInitialDataLoaded(true);
        setShowDateSelection(true);
      }, 500);
    }
  }, [naverMapsLoaded, isMapInitializedActivelog, groupMembers.length, loadingStep]);

  // 백업 타이머 - 초기 로딩이 너무 오래 걸리는 경우 강제 완료
  useEffect(() => {
    // Vercel 환경에서는 더 짧은 백업 타이머 사용
    const isVercel = typeof window !== 'undefined' &&
      (window.location.hostname.includes('vercel.app') ||
        window.location.hostname.includes('nextstep.smap.site'));
    const backupTimeout = isVercel ? 8000 : 10000; // Vercel: 8초, 기타: 10초

    const backupTimer = setTimeout(() => {
      if (isInitialLoading && !hasInitialLoadFailed) {
        console.log(`[LOGS] 백업 타이머 - 초기 로딩 강제 완료 (${backupTimeout}ms)`);
        setIsInitialLoading(false);
        setIsMapLoading(false);
        setIsInitialDataLoaded(true);
        setShowDateSelection(true);
        updateLoadingStepSafe('complete');
        updateLoadingProgressSafe(100);
      }
    }, backupTimeout);

    return () => clearTimeout(backupTimer);
  }, [isInitialLoading, hasInitialLoadFailed]);

  // 초기 로딩 재시도 함수
  const handleInitialLoadingRetry = () => {
    console.log('[LOGS] 초기 로딩 재시도');
    setHasInitialLoadFailed(false);
    setIsInitialLoading(true);
    updateLoadingStepSafe('maps');
    updateLoadingProgressSafe(10);

    // 네이버 지도 API 다시 로드
    loadNaverMapsAPI();
  };

  // 초기 로딩 건너뛰기 함수
  const handleInitialLoadingSkip = () => {
    console.log('[LOGS] 초기 로딩 건너뛰기');
    setIsInitialLoading(false);
    setIsMapLoading(false);
    setIsInitialDataLoaded(true);
    setShowDateSelection(true);
    updateLoadingStepSafe('complete');
    updateLoadingProgressSafe(100);
  };

  const loadNaverMapsAPI = async () => {
    if (window.naver?.maps) {
      console.log('[LOGS] Naver Maps API 이미 로드됨');
      setNaverMapsLoaded(true);
      updateLoadingStepSafe('groups');
      updateLoadingProgressSafe(25);
      return;
    }

    console.log('[LOGS] Naver Maps API 로딩 시작');
    updateLoadingStepSafe('maps');
    updateLoadingProgressSafe(10);

    // 동적 Client ID 가져오기 (도메인별 자동 선택) - Home/Location 페이지와 동일
    const dynamicClientId = API_KEYS.NAVER_MAPS_CLIENT_ID;
    console.log(`🗺️ [LOGS] 네이버 지도 Client ID 사용: ${dynamicClientId}`);

    // Vercel 환경 감지 및 최적화
    const isVercel = window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('nextstep.smap.site');
    const isProduction = window.location.hostname.includes('.smap.site');
    const isIOSWebView = typeof window !== 'undefined' &&
      window.webkit &&
      window.webkit.messageHandlers;

    // 보장 로더 우선 시도 (실패/타임아웃시 폴백)
    try {
      const { ensureNaverMapsLoaded } = await import('../../services/ensureNaverMaps');
      const submodules = (isVercel || isIOSWebView || isProduction) ? 'geocoder' : 'geocoder,drawing,visualization';
      await ensureNaverMapsLoaded({ maxRetries: 6, initialDelayMs: 300, submodules });
      setNaverMapsLoaded(true);
      updateLoadingStepSafe('groups');
      updateLoadingProgressSafe(25);
      return;
    } catch (e) {
      console.warn('[LOGS] ensureNaverMapsLoaded 실패, 수동 로딩으로 폴백', e);
    }

    // 네이버 지도 API 로드용 URL 생성
    const naverMapUrl = new URL(`https://oapi.map.naver.com/openapi/v3/maps.js`);
    naverMapUrl.searchParams.append('ncpKeyId', dynamicClientId);

    // Vercel 환경에서는 최소 모듈만 로드 (안정성 우선)
    if (isVercel || isIOSWebView) {
      naverMapUrl.searchParams.append('submodules', 'geocoder');
      console.log(`🗺️ [LOGS] Vercel/iOS 환경 - 최소 모듈 로드`);
    } else if (!isProduction) {
      // 개발 환경에서만 전체 서브모듈 로드
      naverMapUrl.searchParams.append('submodules', 'geocoder,drawing,visualization');
    } else {
      // 프로덕션에서는 필수 모듈만 로드 (빠른 초기화)
      naverMapUrl.searchParams.append('submodules', 'geocoder,drawing');
    }

    console.log(`🗺️ [LOGS] 네이버 지도 URL: ${naverMapUrl.toString()}`);

    const script = document.createElement('script');
    script.id = 'naver-maps-script-activelog'; // 스크립트 ID 변경 (다른 페이지와 충돌 방지)
    script.src = naverMapUrl.toString();
    script.async = true;
    script.defer = true;

    let hasErrorOccurred = false;

    script.onload = () => {
      console.log('[LOGS] Naver Maps API 로드 완료');
      if (!hasErrorOccurred) {
        setNaverMapsLoaded(true);
        setLoadingStep('groups');
        setLoadingProgress(25);
      }
    };

    script.onerror = () => {
      console.error('[LOGS] Naver Maps API 로드 실패');
      hasErrorOccurred = true;
      setHasInitialLoadFailed(true);
      setIsMapLoading(false);
    };

    const existingScript = document.getElementById('naver-maps-script-activelog');
    if (existingScript) {
      existingScript.remove();
    }

    document.head.appendChild(script);

    // Vercel 환경에서는 더 긴 타임아웃 설정
    const timeout = isVercel ? 20000 : (isIOSWebView ? 15000 : 10000);
    setTimeout(() => {
      if (!window.naver?.maps && !hasErrorOccurred) {
        console.warn(`[LOGS] 네이버 지도 로드 타임아웃 (${timeout}ms)`);
        hasErrorOccurred = true;
        setHasInitialLoadFailed(true);
        setIsMapLoading(false);
      }
    }, timeout);
  };

  // 컴포넌트 인스턴스 등록 및 메인 인스턴스 결정
  useEffect(() => {
    globalComponentInstances++;
    const currentInstanceCount = globalComponentInstances;

    console.log(`[${instanceId.current}] 컴포넌트 생성됨 - 인스턴스 번호: ${currentInstanceCount}`);

    // 첫 번째 인스턴스만 메인으로 설정
    if (currentInstanceCount === 1 && !globalPageExecuted) {
      isMainInstance.current = true;
      globalPageExecuted = true;
      console.log(`[${instanceId.current}] 메인 인스턴스로 설정됨`);

      // 메인 인스턴스에서 첫 번째 그룹 자동 선택 (캐시 또는 API에서)
      if (userGroups && userGroups.length > 0 && !selectedGroupId) {
        const firstGroupId = userGroups[0].sgt_idx;
        console.log(`[${instanceId.current}] 첫 번째 그룹 자동 선택:`, firstGroupId);
        setSelectedGroupId(firstGroupId);
        // 그룹 선택 시 로딩 상태 업데이트
        updateLoadingStepSafe('groups');
        updateLoadingProgressSafe(40);
      }
    } else {
      console.log(`[${instanceId.current}] 서브 인스턴스 - 실행하지 않음`);
    }

    return () => {
      globalComponentInstances--;
      console.log(`[${instanceId.current}] 컴포넌트 제거됨 - 남은 인스턴스: ${globalComponentInstances}`);

      // 모든 인스턴스가 제거되면 전역 플래그 리셋
      if (globalComponentInstances === 0) {
        globalPageExecuted = false;
        console.log('모든 인스턴스 제거됨 - 전역 플래그 리셋');
      }
    };
  }, [userGroups, selectedGroupId]);

  // Vercel 환경에서의 인증 체크
  useEffect(() => {
    if (isVercel && !authLoading) {
      console.log('[LOGS] Vercel 환경 인증 체크:', { isLoggedIn, authLoading, user });

      // Vercel 환경에서는 더 관대한 인증 체크
      if (!isLoggedIn) {
        // 로컬 스토리지에서 토큰 확인
        const hasToken = typeof window !== 'undefined' &&
          (localStorage.getItem('auth-token') ||
            localStorage.getItem('client-token') ||
            localStorage.getItem('token'));

        const hasUserData = typeof window !== 'undefined' &&
          localStorage.getItem('user-data');

        // 쿠키에서도 토큰 확인
        const hasCookieToken = typeof window !== 'undefined' &&
          document.cookie.includes('auth-token=') ||
          document.cookie.includes('client-token=') ||
          document.cookie.includes('token=');

        console.log('[LOGS] Vercel 인증 소스 확인:', {
          hasToken,
          hasUserData,
          hasCookieToken,
          totalAuthSources: [hasToken, hasUserData, hasCookieToken].filter(Boolean).length
        });

        // 모든 인증 소스가 없을 때만 리다이렉트
        if (!hasToken && !hasUserData && !hasCookieToken) {
          console.log('[LOGS] Vercel 환경에서 인증 없음, signin으로 리다이렉트');
          router.push('/signin');
          return;
        }
      }
    }
  }, [isVercel, isLoggedIn, authLoading, user, router]);

  useEffect(() => {
    loadNaverMapsAPI();
  }, []);

  // 멤버 데이터 로드 감지
  useEffect(() => {
    if (groupMembers.length > 0) {
      setIsWaitingForMembers(false);
      console.log('[LOGS 지도] 멤버 데이터 로드 완료, 지도 초기화 준비');
    }
  }, [groupMembers]);

  useEffect(() => {
    // 멤버 데이터가 로드된 후에만 지도 초기화
    if (naverMapsLoaded && mapContainer.current && !map.current && !isWaitingForMembers && groupMembers.length > 0) {
      setIsMapLoading(true);
      try {
        const firstMember = groupMembers[0];
        let initialLat = 37.5665; // 기본값 (서울 시청)
        let initialLng = 126.9780; // 기본값 (서울 시청)
        let memberName = '기본 위치';

        // 첫 번째 멤버의 위치 데이터 우선 사용
        if (firstMember.mlt_lat && firstMember.mlt_long) {
          initialLat = firstMember.mlt_lat;
          initialLng = firstMember.mlt_long;
          memberName = firstMember.name;
        } else if (firstMember.location.lat && firstMember.location.lng) {
          initialLat = firstMember.location.lat;
          initialLng = firstMember.location.lng;
          memberName = firstMember.name;
        }

        const LatLng = (window as any)?.naver?.maps?.LatLng;
        if (!LatLng) {
          console.warn('[Map Init] naver.maps.LatLng 미존재 - SDK 미로딩 또는 해제 상태');
          return;
        }
        const initialCenter = new LatLng(initialLat, initialLng);

        console.log('[LOGS 지도 초기화] 위치 설정:', {
          memberName,
          lat: initialLat,
          lng: initialLng,
          hasMemberData: groupMembers.length > 0
        });

        const mapOptions = {
          ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
          center: initialCenter,
          zoom: MAP_CONFIG.NAVER.DEFAULT_OPTIONS?.zoom || 16,
          logoControl: false,
          mapDataControl: false,
        };
        map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);

        window.naver.maps.Event.addListener(map.current, 'init', () => {
          console.log('[LOGS 지도 초기화] 완료 - 데이터 로딩 준비됨');
          setIsMapInitializedActivelog(true); // 지도 초기화 완료 상태 설정
          setIsMapLoading(false);
          if (map.current) map.current.refresh(true);

          // 지도 초기화 완료 후 멤버 데이터가 있으면 마커 업데이트
          if (groupMembers.length > 0) {
            console.log('[LOGS 지도 초기화] 멤버 마커 업데이트 시작');
            setTimeout(() => {
              updateMemberMarkers(groupMembers, false);
            }, 100);
          }
        });

        // 지도 로딩 타임아웃 설정 (10초)
        setTimeout(() => {
          if (isMapLoading) {
            console.warn('[LOGS 지도 초기화] 타임아웃 - 강제 완료');
            setIsMapLoading(false);
            setIsMapInitializedActivelog(true);
          }
        }, 10000);

      } catch (error) {
        console.error('[LOGS 지도 초기화] 오류:', error);
        setIsMapLoading(false);
        setIsMapInitializedActivelog(true); // 오류 시에도 초기화 완료로 설정
      }
    }
  }, [naverMapsLoaded, isWaitingForMembers, groupMembers]);

  // 🗺️ 지도 초기화 완료 후 멤버 마커 업데이트
  useEffect(() => {
    if (map.current && isMapInitializedActivelog && groupMembers.length > 0) {
      console.log('[LOGS 지도] 초기화 완료 후 멤버 마커 업데이트');
      // 멤버 마커 업데이트
      updateMemberMarkers(groupMembers, false);
    }
  }, [isMapInitializedActivelog]);

  // 🧹 컴포넌트 정리
  useEffect(() => {
    return () => {
      // 기존 마커들 정리
      memberNaverMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      memberNaverMarkers.current = [];

      // 위치 로그 마커들 정리
      locationLogMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      locationLogMarkers.current = [];

      // 위치 로그 연결선 정리
      if (locationLogPolyline.current) {
        locationLogPolyline.current.setMap(null);
        locationLogPolyline.current = null;
      }

      // 시작/종료 마커들 정리
      startEndMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      startEndMarkers.current = [];

      // 체류시간 마커들 정리
      stayTimeMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      stayTimeMarkers.current = [];

      // 화살표 마커들 정리
      arrowMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      arrowMarkers.current = [];

      // 지도 파괴
      if (map.current && typeof map.current.destroy === 'function') {
        map.current.destroy();
      }
      map.current = null;

      // 상태 초기화
      setIsWaitingForMembers(true);
      setIsMapLoading(true);
    };
  }, [naverMapsLoaded, groupMembers]);

  const getRecentDays = useCallback(() => {
    // 디버깅용 로그 추가
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');

    if (!window.getRecentDaysDebugLogged) {
      console.log(`[getRecentDays] 오늘 날짜: ${todayString}, 선택된 날짜: ${selectedDate}`);
      window.getRecentDaysDebugLogged = true;
    }

    const recentDays = Array.from({ length: 14 }, (_, i) => { // 오늘부터 13일전까지 (오늘 포함 14일)
      const date = subDays(new Date(), 13 - i);
      const dateString = format(date, 'yyyy-MM-dd');

      // 실제 데이터에서 해당 날짜의 전체 그룹 로그 개수 확인 (모든 멤버 기준)
      let hasLogs = false;
      let totalDayCount = 0;

      if (dailyCountsData && dailyCountsData.member_daily_counts) {
        // 날짜 형식 맞추기: 2025-06-06 -> 06.06
        const shortDateString = format(date, 'MM.dd');

        // 모든 멤버의 해당 날짜 데이터를 확인하여 하나라도 활동이 있으면 hasLogs = true
        for (const memberData of dailyCountsData.member_daily_counts) {
          const dayData = memberData.daily_counts.find(
            day => day.formatted_date === shortDateString || day.formatted_date === dateString
          );
          if (dayData && dayData.count > 0) {
            totalDayCount += dayData.count;
            hasLogs = true;
          }
        }
      } else {
        // dailyCountsData가 없는 경우 - 초기 로딩 시에는 모든 날짜 활성화
        // 사용자가 데이터를 조회할 수 있도록 허용하고, 실제로 데이터가 없으면 API에서 처리
        hasLogs = true; // 모든 날짜를 클릭 가능하게 변경
      }

      let displayString = format(date, 'MM.dd(E)', { locale: ko }); // 예: "05.07(수)"

      if (i === 13) {
        displayString = `오늘(${format(date, 'E', { locale: ko })})`;
      } else if (i === 12) {
        displayString = `어제(${format(date, 'E', { locale: ko })})`;
      }

      // 오늘 날짜는 항상 클릭 가능하도록 설정
      const isToday = i === 13;
      const finalHasLogs = isToday ? true : hasLogs;

      return {
        value: dateString,
        display: displayString,
        hasLogs: finalHasLogs,
        count: totalDayCount,
        isToday: isToday,
      };
    });

    // 디버깅용: 생성된 날짜 범위와 선택된 날짜 포함 여부 확인
    if (!window.getRecentDaysDebugLogged) {
      const dateRange = recentDays.map(day => day.value);
      const isSelectedDateInRange = dateRange.includes(selectedDate);
      console.log(`[getRecentDays] 생성된 날짜 범위:`, dateRange);
      console.log(`[getRecentDays] 선택된 날짜 ${selectedDate}가 범위에 포함됨:`, isSelectedDateInRange);
      if (!isSelectedDateInRange) {
        console.log(`[getRecentDays] ⚠️ 선택된 날짜가 네모 캘린더 범위를 벗어남!`);
      }
    }

    return recentDays;
  }, [groupMembers, dailyCountsData]);

  // 멤버별 14일간 로그 분포 계산 함수
  const calculateMemberLogDistribution = useCallback((groupMembers: GroupMember[], dailyCountsData: any) => {
    if (!dailyCountsData?.member_daily_counts || !groupMembers.length) {
      return {};
    }

    const distribution: Record<string, boolean[]> = {};
    const today = new Date();

    groupMembers.forEach(member => {
      const memberLogs: boolean[] = [];
      const memberMtIdx = parseInt(member.id);

      // 해당 멤버의 일별 카운트 데이터 찾기
      const memberData = dailyCountsData.member_daily_counts.find(
        (memberCount: any) => memberCount.member_id === memberMtIdx
      );

      // 14일간 (오늘부터 13일 전까지)
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const shortDateStr = format(date, 'MM.dd'); // MM.dd

        let hasLogs = false;
        if (memberData?.daily_counts) {
          // 날짜 형식이 MM.dd 또는 YYYY-MM-DD 둘 다 확인
          const dayData = memberData.daily_counts.find(
            (day: any) => day.formatted_date === shortDateStr || day.formatted_date === dateStr
          );
          hasLogs = dayData && dayData.count > 0;
        }

        memberLogs.push(hasLogs);
      }

      distribution[member.id] = memberLogs;
    });

    return distribution;
  }, []);



  // dailyCountsData 변경 시 멤버별 로그 분포 업데이트
  useEffect(() => {
    if (dailyCountsData && groupMembers.length > 0) {
      const distribution = calculateMemberLogDistribution(groupMembers, dailyCountsData);
      setMemberLogDistribution(distribution);
    }
  }, [dailyCountsData, groupMembers, calculateMemberLogDistribution]);

  // 그룹 멤버가 로딩된 후 일별 카운트 데이터 즉시 로드 (사이드바 구조 변화 방지)
  useEffect(() => {
    if (groupMembers.length > 0 && selectedGroupId && !dailyCountsData) {
      console.log('[LOGS] 그룹 멤버 로딩 완료 - 일별 카운트 데이터 즉시 로드 (사이드바 구조 변화 방지)');

      // 즉시 일별 카운트 데이터 로드 (사이드바 열림과 동시에 데이터 준비)
      loadDailyLocationCounts(selectedGroupId, 14).then(() => {
        console.log('[LOGS] 일별 카운트 데이터 즉시 로드 완료 - 사이드바 구조 변화 방지됨');
      }).catch(error => {
        console.error('[LOGS] 일별 카운트 데이터 즉시 로드 실패:', error);
      });
    }
  }, [groupMembers.length, selectedGroupId, dailyCountsData]);

  // 사이드바 날짜 선택 부분 초기 스크롤 설정 (일별 카운트 데이터는 이미 로드되어 있음)
  useEffect(() => {
    if (isSidebarOpen) {
      // 사이드바가 열릴 때는 이미 로드된 데이터를 사용하므로 추가 로딩 없음
      console.log('[LOGS] 사이드바 열림 - 이미 로드된 데이터 사용');

      // 사이드바가 열리고 DOM이 렌더링된 후 오늘 날짜로 스크롤
      if (dateScrollContainerRef.current) {
        const timer = setTimeout(() => {
          scrollToTodayDate('사이드바 날짜 초기화');
        }, 20); // 지연 시간 더 단축 (데이터가 이미 준비되어 있음)

        return () => clearTimeout(timer);
      }
    }
  }, [isSidebarOpen]);

  // home/page.tsx와 동일한 드래그 핸들러들
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const target = e.target as HTMLElement;

    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    // 스케줄 스크롤 영역 체크
    const isInScheduleArea = target.closest('[data-schedule-scroll="true"]') ||
      target.closest('[data-schedule-item="true"]') ||
      target.closest('[data-calendar-swipe="true"]');

    if (isInScheduleArea) {
      console.log('[BottomSheet] 스케줄 영역에서의 터치 - 바텀시트 드래그 비활성화');
      return; // 스케줄 영역에서는 바텀시트 드래그 비활성화
    }

    startDragY.current = clientY;
    startDragX.current = clientX;
    dragStartTime.current = performance.now();
    isDraggingRef.current = true;
    isHorizontalSwipeRef.current = null; // 방향 판단 초기화
    hasUserInteracted.current = true; // 사용자 상호작용 플래그 설정

    // 시작 시간 저장 (정확한 속도 계산용)
    (e.target as any)._startedAt = performance.now();

    console.log('[BottomSheet] 드래그 시작:', { clientY, clientX });
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current || !startDragY.current || !startDragX.current || !dragStartTime.current) {
      return;
    }

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const target = e.target as HTMLElement;

    const deltaY = clientY - startDragY.current;
    const deltaX = clientX - startDragX.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const directionThreshold = 10; // 방향 감지 임계값을 더 민감하게 조정

    // 방향이 아직 결정되지 않았다면 결정
    if (isHorizontalSwipeRef.current === null) {
      if (absDeltaX > directionThreshold) {
        isHorizontalSwipeRef.current = true;
        console.log('[DragMove] 수평 스와이프 감지 (민감)');
      } else if (absDeltaY > directionThreshold) {
        isHorizontalSwipeRef.current = false;
        console.log('[DragMove] 수직 드래그 감지');
      }
    }

    // 좌우 스와이프: 탭 전환 (더 민감하게)
    if (isHorizontalSwipeRef.current === true) {
      const minSwipeDistance = 30; // 최소 스와이프 거리를 줄임
      if (Math.abs(deltaX) < minSwipeDistance) return;

      // 좌우 스와이프는 더 이상 지원하지 않음 (단일 탭)
      return;
    }

    // 상하 드래그: 바텀시트 상태 변경은 handleDragEnd에서 처리
    console.log('[DragMove] 수직 드래그 중:', deltaY);
  };

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    if (!isDraggingRef.current || !startDragY.current || !startDragX.current) {
      isDraggingRef.current = false;
      return;
    }

    const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const target_element = e.target as HTMLElement;

    const dragDeltaY = clientY - startDragY.current;
    const dragDeltaX = clientX - startDragX.current;
    const deltaTime = dragStartTime.current ? performance.now() - dragStartTime.current : 0;

    // 햅틱 피드백 함수 - 사용자 상호작용 후에만 실행
    const triggerHaptic = () => {
      // 사용자 상호작용이 없으면 햅틱 피드백 건너뜀
      if (!hasUserInteracted.current || !('vibrate' in navigator)) {
        return;
      }

      try {
        // document가 활성 상태일 때만 실행
        if (document.visibilityState === 'visible' && !document.hidden) {
          navigator.vibrate([20, 5, 15]);
        }
      } catch (error) {
        // 에러 발생 시 조용히 무시 (콘솔 노이즈 방지)
      }
    };

    // 탭 동작인지 확인 (짧은 시간 + 작은 움직임)
    const isTap = Math.abs(dragDeltaY) < 10 && Math.abs(dragDeltaX) < 10 && deltaTime < 200;

    console.log('[DragEnd] 드래그 종료:', {
      deltaY: dragDeltaY,
      deltaX: dragDeltaX,
      deltaTime,
      isTap,
      isHorizontalSwipe: isHorizontalSwipeRef.current
    });

    // 좌우 스와이프: 사이드바 제어 비활성화 - 무조건 끝까지 실행
    if (isHorizontalSwipeRef.current === true) {
      const minSwipeDistance = 30; // 최소 스와이프 거리
      if (Math.abs(dragDeltaX) < minSwipeDistance) {
        // 초기화 후 종료
        isDraggingRef.current = false;
        startDragY.current = null;
        startDragX.current = null;
        dragStartTime.current = null;
        isHorizontalSwipeRef.current = null;
        (e.target as any)._startedAt = 0;
        return;
      }

      // 좌우 스와이프 액션 감지했지만 사이드바 제어하지 않음 - 액션 완료까지 실행
      console.log('[DragEnd] 좌우 스와이프 감지 - 사이드바 제어 비활성화, 액션 완료');

      // 초기화
      isDraggingRef.current = false;
      startDragY.current = null;
      startDragX.current = null;
      dragStartTime.current = null;
      isHorizontalSwipeRef.current = null;
      (e.target as any)._startedAt = 0;
      return;
    }

    // 바텀시트가 제거되어 상하 드래그 처리 불필요

    // 초기화
    isDraggingRef.current = false;
    startDragY.current = null;
    startDragX.current = null;
    dragStartTime.current = null;
    isHorizontalSwipeRef.current = null;
    (e.target as any)._startedAt = 0;
  };



  // 멤버의 최근 활동 날짜를 찾는 함수
  const findMemberRecentActiveDate = (memberId: string): string => {
    if (!dailyCountsData?.member_daily_counts) {
      return format(new Date(), 'yyyy-MM-dd'); // 기본값으로 오늘 반환
    }

    const memberMtIdx = parseInt(memberId);
    const memberData = dailyCountsData.member_daily_counts.find(
      (member: any) => member.member_id === memberMtIdx
    );

    if (!memberData?.daily_counts) {
      return format(new Date(), 'yyyy-MM-dd'); // 기본값으로 오늘 반환
    }

    // 최근 14일 중 활동이 있는 가장 최근 날짜 찾기
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const shortDateStr = format(checkDate, 'MM.dd');

      const dayData = memberData.daily_counts.find(
        (day: any) => day.formatted_date === shortDateStr || day.formatted_date === dateStr
      );

      if (dayData && dayData.count > 0) {
        console.log(`[findMemberRecentActiveDate] 멤버 ${memberId}의 최근 활동 날짜: ${dateStr} (${dayData.count}건)`);
        return dateStr;
      }
    }

    console.log(`[findMemberRecentActiveDate] 멤버 ${memberId}의 최근 활동 없음 - 오늘 날짜 반환`);
    return format(new Date(), 'yyyy-MM-dd'); // 활동이 없으면 오늘 반환
  };

  const handleMemberSelect = useCallback(async (id: string, e?: React.MouseEvent | null): Promise<void> => {
    console.log('[handleMemberSelect] 멤버 선택 시작:', id);

    // 이벤트가 null인 경우는 자동 선택, 있는 경우는 사용자 선택
    const isUserManualSelection = e !== null && e !== undefined;

    console.log('[LOGS] ===== 멤버 선택 시작 =====');
    console.log('[LOGS] 멤버 ID:', id, isUserManualSelection ? '(사용자 선택)' : '(자동 선택)');

    // 사용자가 의도적으로 멤버를 선택했음을 표시
    if (isUserManualSelection) {
      setIsInitialEntry(false);
    }

    // 현재 선택된 멤버와 같으면 무시 (사용자 수동 선택이 아닌 경우)
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    if (!isUserManualSelection && currentSelectedMember?.id === id) {
      console.log('[LOGS] 같은 멤버 자동 선택 - 무시');
      return;
    }

    console.log('[LOGS] 멤버 변경 - 통합 데이터 로딩 시작');

    // 지도 초기화
    clearMapMarkersAndPaths(false, true);
    setLocationSummary(DEFAULT_LOCATION_SUMMARY);

    try {
      // 사용자 수동 선택일 때만 데이터 로딩
      if (isUserManualSelection) {
        // 통합 함수로 날짜+멤버 데이터 로딩
        await loadDateMemberData(selectedDate, id, 'member');

        // 사이드바 자동 닫기
        setTimeout(() => {
          setIsSidebarOpen(false);
          console.log('[handleMemberSelect] 멤버 선택 완료 - 사이드바 자동 닫기');
        }, 300);
      } else {
        // 자동 선택일 때는 상태만 업데이트
        const updatedMembers = groupMembers.map(member => ({
          ...member,
          isSelected: member.id === id
        }));
        setGroupMembers(updatedMembers);
        console.log('[handleMemberSelect] 자동 선택 - 상태만 업데이트');
      }

    } catch (error) {
      console.error('[handleMemberSelect] 멤버 선택 오류:', error);
      setIsLocationDataLoading(false);
      setIsMapLoading(false);
    }

    console.log('[LOGS] ===== 멤버 선택 완료 =====');
  }, [groupMembers, selectedDate, setIsInitialEntry, setIsSidebarOpen, setLocationSummary, setIsLocationDataLoading, setIsMapLoading]);

  // 위치 로그 마커를 지도에 업데이트하는 함수 (새 함수로 대체)
  // const updateLocationLogMarkers = async (markers: MapMarker[]): Promise<void> => { /* ... */ };

  // 체류시간 마커를 지도에 업데이트하는 함수 (새 함수로 대체)
  // const updateStayTimeMarkers = async (stayTimes: StayTime[], startEndPoints?: { start?: any, end?: any }): Promise<void> => { /* ... */ };

  // --- 새로운 통합 지도 렌더링 함수 ---

  const updateMemberMarkers = (members: GroupMember[], isDateChange: boolean = false) => {
    // 그룹멤버 마커는 더 이상 사용하지 않음
    console.log('[updateMemberMarkers] 그룹멤버 마커 기능이 비활성화됨');
    return;
  };

  // 지도 마커와 경로 즉시 초기화 함수 - 완전 강화 버전
  const clearMapMarkersAndPaths = (clearMemberMarkers: boolean = false, cancelPendingRequests: boolean = true, refreshMap: boolean = true) => {
    console.log('[clearMapMarkersAndPaths] ===== 완전 초기화 시작 =====');
    console.log('[clearMapMarkersAndPaths] 제거할 마커 개수:', {
      locationLog: locationLogMarkers.current.length,
      startEnd: startEndMarkers.current.length,
      stayTime: stayTimeMarkers.current.length,
      arrow: arrowMarkers.current.length,
      member: memberNaverMarkers.current.length,
      currentPosition: currentPositionMarker.current ? 1 : 0,
      polyline: locationLogPolyline.current ? 1 : 0
    });

    // 1. 조건부 요청 취소 - 일반적인 위치 로그 정리시에는 취소하지 않음
    if (cancelPendingRequests && loadLocationDataExecutingRef.current?.executing) {
      console.log(`[clearMapMarkersAndPaths] 진행 중인 요청 강제 취소: ${loadLocationDataExecutingRef.current.currentRequest}`);
      loadLocationDataExecutingRef.current.cancelled = true;
      loadLocationDataExecutingRef.current.executing = false;
      loadLocationDataExecutingRef.current.currentRequest = undefined;
    } else if (!cancelPendingRequests) {
      console.log('[clearMapMarkersAndPaths] 진행 중인 요청은 유지함 (위치 로그 정리만 수행)');
    }

    // 2. 모든 InfoWindow 먼저 닫기
    if (window.naver?.maps) {
      try {
        // 모든 활성 InfoWindow 닫기
        const infoWindows = document.querySelectorAll('.naver-info-window');
        infoWindows.forEach(el => el.remove());
      } catch (e) {
        console.log('[clearMapMarkersAndPaths] InfoWindow 정리 중 오류 무시:', e);
      }
    }

    // 3. 위치 로그 마커들 완전 정리
    try {
      locationLogMarkers.current.forEach((marker, index) => {
        if (marker) {
          try {
            if (marker.infoWindow) {
              marker.infoWindow.close();
              marker.infoWindow = null;
            }
            if (marker.setMap) {
              marker.setMap(null);
            }
          } catch (e) {
            console.log(`[clearMapMarkersAndPaths] 위치 로그 마커 ${index} 제거 오류 무시:`, e);
          }
        }
      });
      locationLogMarkers.current = [];
      console.log('[clearMapMarkersAndPaths] 위치 로그 마커 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 위치 로그 마커 정리 오류 무시:', e);
      locationLogMarkers.current = [];
    }

    // 4. 경로 폴리라인 완전 정리
    try {
      if (locationLogPolyline.current) {
        locationLogPolyline.current.setMap(null);
        locationLogPolyline.current = null;
      }

      // 그라데이션 경로들 정리
      if (window.gradientPolylines) {
        window.gradientPolylines.forEach((polyline: any) => {
          try { polyline.setMap(null); } catch (e) { console.error('Error removing gradient polyline:', e); }
        });
        window.gradientPolylines = [];
      }

      // 혹시 모를 다른 경로들도 정리
      if (window.naver?.maps && map.current) {
        const overlays = map.current.overlays;
        if (overlays && overlays.forEach) {
          overlays.forEach((overlay: any) => {
            if (overlay && overlay.setMap) {
              overlay.setMap(null);
            }
          });
        }
      }
      console.log('[clearMapMarkersAndPaths] 경로 폴리라인 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 경로 정리 오류 무시:', e);
      locationLogPolyline.current = null;
    }

    // 5. 시작/종료 마커들 완전 정리
    try {
      startEndMarkers.current.forEach((marker, index) => {
        if (marker) {
          try {
            if (marker.infoWindow) {
              marker.infoWindow.close();
              marker.infoWindow = null;
            }
            if (marker.setMap) {
              marker.setMap(null);
            }
          } catch (e) {
            console.log(`[clearMapMarkersAndPaths] 시작/종료 마커 ${index} 제거 오류 무시:`, e);
          }
        }
      });
      startEndMarkers.current = [];
      console.log('[clearMapMarkersAndPaths] 시작/종료 마커 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 시작/종료 마커 정리 오류 무시:', e);
      startEndMarkers.current = [];
    }

    // 6. 체류시간 마커들 완전 정리
    try {
      stayTimeMarkers.current.forEach((marker, index) => {
        if (marker) {
          try {
            if (marker.infoWindow) {
              marker.infoWindow.close();
              marker.infoWindow = null;
            }
            if (marker.setMap) {
              marker.setMap(null);
            }
          } catch (e) {
            console.log(`[clearMapMarkersAndPaths] 체류시간 마커 ${index} 제거 오류 무시:`, e);
          }
        }
      });
      stayTimeMarkers.current = [];
      console.log('[clearMapMarkersAndPaths] 체류시간 마커 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 체류시간 마커 정리 오류 무시:', e);
      stayTimeMarkers.current = [];
    }

    // 6-1. 화살표 마커들 완전 정리
    try {
      arrowMarkers.current.forEach((marker, index) => {
        if (marker) {
          try {
            if (marker.setMap) {
              marker.setMap(null);
            }
          } catch (e) {
            console.log(`[clearMapMarkersAndPaths] 화살표 마커 ${index} 제거 오류 무시:`, e);
          }
        }
      });
      arrowMarkers.current = [];
      console.log('[clearMapMarkersAndPaths] 화살표 마커 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 화살표 마커 정리 오류 무시:', e);
      arrowMarkers.current = [];
    }

    // 7. 현재 위치 마커 완전 정리
    try {
      if (currentPositionMarker.current) {
        if (currentPositionMarker.current.infoWindow) {
          currentPositionMarker.current.infoWindow.close();
          currentPositionMarker.current.infoWindow = null;
        }
        currentPositionMarker.current.setMap(null);
        currentPositionMarker.current = null;
      }
      console.log('[clearMapMarkersAndPaths] 현재 위치 마커 완전 정리 완료');
    } catch (e) {
      console.log('[clearMapMarkersAndPaths] 현재 위치 마커 정리 오류 무시:', e);
      currentPositionMarker.current = null;
    }

    // 8. 멤버 마커들 조건부 정리
    if (clearMemberMarkers) {
      try {
        memberNaverMarkers.current.forEach((marker, index) => {
          if (marker) {
            try {
              if (marker.setMap) {
                marker.setMap(null);
              }
            } catch (e) {
              console.log(`[clearMapMarkersAndPaths] 멤버 마커 ${index} 제거 오류 무시:`, e);
            }
          }
        });
        memberNaverMarkers.current = [];
        console.log('[clearMapMarkersAndPaths] 멤버 마커 완전 정리 완료');
      } catch (e) {
        console.log('[clearMapMarkersAndPaths] 멤버 마커 정리 오류 무시:', e);
        memberNaverMarkers.current = [];
      }
    } else {
      console.log('[clearMapMarkersAndPaths] 멤버 마커는 보존함 (위치 로그 정리와 별개)');
    }

    // 9. 모든 React 상태 즉시 초기화 (위치기록 요약 제외 - 명시적으로만 초기화)
    setCurrentLocationLogs([]);
    setDailySummaryData([]);
    setStayTimesData([]);
    // setMapMarkersData([]); // 마커 데이터는 지도 정리와 별개로 관리 - useEffect 무한 루프 방지
    setLocationLogSummaryData(null);
    // setLocationSummary(DEFAULT_LOCATION_SUMMARY); // 자동 초기화 제거 - handleMemberSelect/handleDateSelect에서만 처리
    setSortedLocationData([]);
    setSliderValue(0);
    setIsSliderDragging(false);

    // 10. 조건부 지도 새로고침 (렌더링 중에는 새로고침 방지)
    if (refreshMap && map.current) {
      try {
        map.current.refresh(true);
        setTimeout(() => {
          if (map.current) {
            map.current.refresh(true);
            setTimeout(() => {
              if (map.current) {
                map.current.refresh(true);
                console.log('[clearMapMarkersAndPaths] 지도 삼중 새로고침 완료');
              }
            }, 50);
          }
        }, 50);
      } catch (e) {
        console.log('[clearMapMarkersAndPaths] 지도 새로고침 오류 무시:', e);
      }
    } else if (!refreshMap) {
      console.log('[clearMapMarkersAndPaths] 지도 새로고침 건너뜀 (렌더링 중)');
    }

    console.log('[clearMapMarkersAndPaths] ===== 완전 초기화 완료 =====');
  };

  const handleDateSelect = useCallback(async (date: string) => {
    console.log('[LOGS] ===== 날짜 선택 시작 =====');
    console.log('[LOGS] 새 날짜:', date, '현재 날짜:', selectedDate);

    // 사용자가 의도적으로 날짜를 선택했음을 표시
    setIsInitialEntry(false);

    // 같은 날짜면 무시
    if (selectedDate === date) {
      console.log('[LOGS] 같은 날짜 선택 - 무시');
      return;
    }

    console.log('[LOGS] 날짜 변경 - 통합 데이터 로딩 시작');

    // 지도 초기화
    clearMapMarkersAndPaths(true);
    setLocationSummary(DEFAULT_LOCATION_SUMMARY);

    try {
      // 통합 함수로 날짜+멤버 데이터 로딩
      await loadDateMemberData(date, undefined, 'date');

      // 사이드바 날짜 동기화 추가 보장 (loadDateMemberData에서도 호출하지만 추가 보장)
      setTimeout(() => {
        scrollSidebarDateToSelected(date);
        console.log('[handleDateSelect] 사이드바 날짜 동기화 추가 보장:', date);
      }, 500);

      // 사이드바 자동 닫기
      setTimeout(() => {
        setIsSidebarOpen(false);
        console.log('[handleDateSelect] 날짜 선택 완료 - 2초 후 사이드바 자동 닫기');
      }, 2000);

    } catch (error) {
      console.error('[handleDateSelect] 날짜 선택 오류:', error);
      setIsLocationDataLoading(false);
      setIsMapLoading(false);
    }

    console.log('[LOGS] ===== 날짜 선택 완료 =====');
  }, [selectedDate, setIsInitialEntry, setIsSidebarOpen, setLocationSummary, setIsLocationDataLoading, setIsMapLoading]);

  // 🚀 네모 캘린더 데이터 강제 재생성 함수
  const forceRegenerateCalendarData = useCallback(async () => {
    console.log('[🔄 FORCE REGEN] 네모 캘린더 데이터 강제 재생성 시작');

    if (!selectedGroupId) {
      console.warn('[🔄 FORCE REGEN] selectedGroupId가 없어서 중단');
      return false;
    }

    try {
      // 1단계: 일별 카운트 데이터 강제 재조회
      console.log('[🔄 FORCE REGEN] 1단계: 일별 카운트 데이터 강제 재조회');

      let dailyCountsResponse = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && !dailyCountsResponse) {
        try {
          console.log(`[🔄 FORCE REGEN] 일별 카운트 조회 시도 ${retryCount + 1}/${maxRetries}`);
          dailyCountsResponse = await memberLocationLogService.getDailyLocationCounts(selectedGroupId, 14);

          if (dailyCountsResponse?.member_daily_counts && dailyCountsResponse.member_daily_counts.length > 0) {
            console.log(`[🔄 FORCE REGEN] 일별 카운트 조회 성공 (${retryCount + 1}번째 시도):`, dailyCountsResponse.member_daily_counts.length, '명');
            break;
          }

          console.warn(`[🔄 FORCE REGEN] 일별 카운트 조회 결과 없음 (${retryCount + 1}번째 시도)`);
          retryCount++;

          if (retryCount < maxRetries) {
            const backoffDelay = Math.min(500 * Math.pow(2, retryCount), 2000);
            console.log(`[🔄 FORCE REGEN] ${backoffDelay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        } catch (error) {
          console.error(`[🔄 FORCE REGEN] 일별 카운트 조회 오류 (${retryCount + 1}번째 시도):`, error);
          retryCount++;

          if (retryCount < maxRetries) {
            const backoffDelay = Math.min(500 * Math.pow(2, retryCount), 2000);
            console.log(`[🔄 FORCE REGEN] 오류 발생, ${backoffDelay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }

      if (!dailyCountsResponse?.member_daily_counts?.length) {
        console.error('[🔄 FORCE REGEN] 일별 카운트 데이터 재조회 실패');
        return false;
      }

      // 2단계: 상태 업데이트
      console.log('[🔄 FORCE REGEN] 2단계: 상태 업데이트');
      setDailyCountsData(dailyCountsResponse);

      // 3단계: 멤버별 로그 분포 재계산
      console.log('[🔄 FORCE REGEN] 3단계: 멤버별 로그 분포 재계산');
      const newDistribution = calculateMemberLogDistribution(groupMembers, dailyCountsResponse);
      setMemberLogDistribution(newDistribution);

      console.log('[🔄 FORCE REGEN] 네모 캘린더 데이터 강제 재생성 완료');

      return true;
    } catch (error) {
      console.error('[🔄 FORCE REGEN] 네모 캘린더 데이터 재생성 실패:', error);
      return false;
    }
  }, [selectedGroupId, groupMembers, calculateMemberLogDistribution]);

  // 🔍 데이터 일치성 검증 함수
  const verifyDataConsistency = useCallback((memberName: string, dateString: string): boolean => {
    console.log(`[🔍 VERIFY] ${memberName}의 ${dateString} 데이터 일치성 검증 시작`);

    const member = groupMembers.find(m => m.name === memberName);
    if (!member) {
      console.warn(`[🔍 VERIFY] 멤버를 찾을 수 없음: ${memberName}`);
      return false;
    }

    // 네모 캘린더에서 해당 날짜에 데이터가 있는지 확인
    const today = new Date();
    const targetDate = new Date(dateString);
    const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0 || daysDiff > 13) {
      console.warn(`[🔍 VERIFY] 날짜가 14일 범위를 벗어남: ${dateString} (${daysDiff}일 차이)`);
      return true; // 범위를 벗어나면 검증 통과로 처리
    }

    const arrayIndex = 13 - daysDiff;
    const hasLogInCalendar = Boolean((memberLogDistribution[member.id] || Array(14).fill(false))[arrayIndex]);

    // 일별 카운트 데이터에서 해당 날짜 확인
    let hasLogInDailyCount = false;
    if (dailyCountsData?.member_daily_counts) {
      const memberData = dailyCountsData.member_daily_counts.find(
        (memberCount: any) => memberCount.member_id === parseInt(member.id)
      );

      if (memberData?.daily_counts) {
        const shortDateStr = format(targetDate, 'MM.dd');
        const dayData = memberData.daily_counts.find(
          (day: any) => day.formatted_date === shortDateStr || day.formatted_date === dateString
        );
        hasLogInDailyCount = Boolean(dayData && dayData.count > 0);
      }
    }

    console.log(`[🔍 VERIFY] ${memberName}의 ${dateString} 검증 결과:`, {
      hasLogInCalendar,
      hasLogInDailyCount,
      isConsistent: hasLogInCalendar === hasLogInDailyCount
    });

    return hasLogInCalendar === hasLogInDailyCount;
  }, [groupMembers, memberLogDistribution, dailyCountsData]);

  // 📊 네모 캘린더 클릭 시 멤버와 날짜를 순서대로 변경하는 함수 (데이터 검증 포함)
  const handleCalendarSquareClick = async (member: GroupMember, dateString: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof (e as any).stopImmediatePropagation === 'function') {
      (e as any).stopImmediatePropagation();
    }

    // CSS로 스크롤이 이미 차단되어 있으므로 추가 처리 불필요

    console.log(`[네모 캘린더] 클릭 시작 - 멤버: ${member.name}, 날짜: ${dateString}`);
    console.log(`[네모 캘린더] 현재 상태 - 선택된 멤버: ${groupMembers.find(m => m.isSelected)?.name}, 선택된 날짜: ${selectedDate}`);

    // 사용자가 의도적으로 네모 캘린더를 클릭했음을 표시
    setIsInitialEntry(false);

    // 클릭된 네모에 시각적 피드백
    const clickedElement = e.currentTarget as HTMLElement;
    clickedElement.style.transform = 'scale(1.2) translateY(-1px)';
    clickedElement.style.boxShadow = '0 8px 25px -5px rgba(236, 72, 153, 0.4), 0 0 0 3px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    clickedElement.style.zIndex = '1000';
    clickedElement.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

    try {
      // 🔍 0단계: 데이터 일치성 검증
      const isConsistent = verifyDataConsistency(member.name, dateString);

      if (!isConsistent) {
        console.warn(`[네모 캘린더] 데이터 불일치 감지 - 강제 재생성 시도`);

        // 데이터 불일치 시 강제 재생성
        const regenerationSuccess = await forceRegenerateCalendarData();

        if (!regenerationSuccess) {
          console.error(`[네모 캘린더] 데이터 재생성 실패 - 그대로 진행`);
        } else {
          console.log(`[네모 캘린더] 데이터 재생성 성공 - 재검증`);

          // 재생성 후 다시 검증
          const isConsistentAfterRegen = verifyDataConsistency(member.name, dateString);
          if (isConsistentAfterRegen) {
            console.log(`[네모 캘린더] 재생성 후 데이터 일치성 확인됨`);
          } else {
            console.warn(`[네모 캘린더] 재생성 후에도 데이터 불일치`);
          }
        }

        // UI 안정화를 위한 대기
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 1단계: 멤버가 다른 경우 또는 날짜가 다른 경우 통합 처리
      if (!member.isSelected || selectedDate !== dateString) {
        if (!member.isSelected) {
          console.log(`[네모 캘린더] 멤버 변경: ${groupMembers.find(m => m.isSelected)?.name} → ${member.name}`);
        }
        if (selectedDate !== dateString) {
          console.log(`[네모 캘린더] 날짜 변경: ${selectedDate} → ${dateString}`);
        }

        // 지도 초기화
        clearMapMarkersAndPaths(false, true);
        setLocationSummary(DEFAULT_LOCATION_SUMMARY);

        // 통합 함수로 날짜+멤버 데이터 로딩 (명시적으로 멤버 ID 전달)
        await loadDateMemberData(dateString, member.id, 'date');

        console.log(`[네모 캘린더] 처리 완료: ${member.name}, ${dateString}`);
      } else {
        console.log(`[네모 캘린더] 같은 멤버, 같은 날짜 - 처리 생략`);
      }

      // 사이드바 자동 닫기
      setTimeout(() => {
        setIsSidebarOpen(false);
        console.log('[네모 캘린더] 처리 완료 - 사이드바 자동 닫기');
      }, 500);

    } catch (error) {
      console.error('[네모 캘린더] 처리 중 오류:', error);
      setIsLocationDataLoading(false);
      setIsMapLoading(false);
    }

    // 시각적 피드백 원복
    setTimeout(() => {
      clickedElement.style.transform = '';
      clickedElement.style.boxShadow = '';
      clickedElement.style.zIndex = '';
      clickedElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

      setTimeout(() => {
        clickedElement.style.transition = '';
      }, 300);
    }, 250);

    // 햅틱 피드백
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]);
      }
    } catch (err) {
      console.debug('햅틱 피드백 차단');
    }
  };

  // 위치 데이터 로딩 후 지도 초기화를 수행하는 함수
  const loadLocationDataWithMapPreset = async (mtIdx: number, date: string, member: GroupMember, forceToday: boolean = false) => {
    if (!map.current || !member) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const targetDate = forceToday ? today : date;

    console.log('[loadLocationDataWithMapPreset] 시작:', {
      memberName: member.name,
      mtIdx,
      targetDate,
      forceToday
    });

    try {
      // 먼저 모든 위치로그 데이터를 조회
      await loadLocationDataWithMapInit(mtIdx, targetDate, member);

    } catch (error) {
      console.error('[loadLocationDataWithMapPreset] 오류:', error);

      // 오류 시에도 멤버의 현재 위치로 지도 설정
      const currentLat = member.mlt_lat || member.location.lat || 37.5665;
      const currentLng = member.mlt_long || member.location.lng || 126.9780;
      const LatLng1 = (window as any)?.naver?.maps?.LatLng; if (!LatLng1) return;
      const adjustedPosition = new LatLng1(currentLat, currentLng);

      map.current.setCenter(adjustedPosition);
      map.current.setZoom(16);

      console.log('[loadLocationDataWithMapPreset] 오류 발생 - 현재 위치로 폴백:', {
        currentLat, currentLng
      });
    }
  };

  // 위치 데이터 로딩 후 지도 초기화 수행하는 함수
  const loadLocationDataWithMapInit = async (mtIdx: number, date: string, member: GroupMember) => {
    if (!map.current || !member) return;

    // 먼저 모든 위치로그 데이터를 조회
    await loadLocationData(mtIdx, date);

    // 데이터 로딩 완료 후 지도 초기화는 loadLocationData 내부에서 자동으로 처리됨
    console.log('[loadLocationDataWithMapInit] 데이터 로딩 완료 - 지도 초기화는 자동 처리');
  };

  // 데이터 로딩 완료 후 지도 초기화 함수 (시작위치가 있을 때만 이동)
  const initializeMapAfterDataLoad = (member: GroupMember, date: string) => {
    if (!map.current || !member) return;

    console.log('[initializeMapAfterDataLoad] 데이터 로딩 완료 후 지도 초기화 시작:', member.name);

    // mapMarkersData에서 첫 번째 위치 확인 - 시작위치가 있을 때만 이동
    if (mapMarkersData && mapMarkersData.length > 0) {
      const firstMarker = mapMarkersData[0];
      const startLat = firstMarker.latitude || firstMarker.mlt_lat || 0;
      const startLng = firstMarker.longitude || firstMarker.mlt_long || 0;

      if (startLat !== 0 && startLng !== 0) {
        // 현재 지도 중심과 시작지점이 다를 때만 이동
        const currentCenter = map.current.getCenter();
        const currentLat = currentCenter.lat();
        const currentLng = currentCenter.lng();

        const targetLat = startLat;

        // 현재 위치와 시작위치가 충분히 다를 때만 이동 (0.001도 이상 차이)
        const latDiff = Math.abs(currentLat - targetLat);
        const lngDiff = Math.abs(currentLng - startLng);

        if (latDiff > 0.001 || lngDiff > 0.001) {
          const LatLng2 = (window as any)?.naver?.maps?.LatLng; if (!LatLng2) return;
          const adjustedPosition = new LatLng2(targetLat, startLng);
          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16);

          console.log('[initializeMapAfterDataLoad] 시작지점으로 지도 중심 이동:', {
            from: { lat: currentLat, lng: currentLng },
            to: { lat: targetLat, lng: startLng },
            startLat, startLng, date
          });
        } else {
          console.log('[initializeMapAfterDataLoad] 현재 위치와 시작지점이 유사하여 이동하지 않음:', {
            current: { lat: currentLat, lng: currentLng },
            target: { lat: targetLat, lng: startLng }
          });
        }

        // 시작지점 InfoWindow 자동 표시 (마커 생성 대기)
        setTimeout(() => {
          // 마커가 생성될 때까지 기다렸다가 InfoWindow 표시
          const checkMarkerAndShowInfo = () => {
            if (startEndMarkers.current && startEndMarkers.current.length > 0) {
              showStartPointInfoWindow(startLat, startLng, member.name, date);
            } else {
              // 마커가 아직 없으면 0.5초 후 다시 시도 (최대 3번)
              setTimeout(() => {
                if (startEndMarkers.current && startEndMarkers.current.length > 0) {
                  showStartPointInfoWindow(startLat, startLng, member.name, date);
                } else {
                  // 마지막 시도: 마커 없이도 위치 기반으로 표시
                  console.log('[initializeMapAfterDataLoad] 마커 없이 위치 기반 InfoWindow 표시');
                  showStartPointInfoWindow(startLat, startLng, member.name, date);
                }
              }, 500);
            }
          };
          checkMarkerAndShowInfo();
        }, 800); // 지도 이동 및 마커 생성 완료 후 InfoWindow 표시

        return;
      }
    }

    console.log('[initializeMapAfterDataLoad] 위치 데이터가 없어 지도 중심 유지:', {
      memberName: member.name, date, reason: '위치 데이터 없음'
    });
  };

  // 시작지점 InfoWindow 표시 함수
  const showStartPointInfoWindow = (lat: number, lng: number, memberName: string, date: string) => {
    if (!map.current) return;

    console.log('[showStartPointInfoWindow] 시작지점 InfoWindow 표시 시도:', {
      lat, lng, memberName, date,
      hasStartEndMarkers: startEndMarkers.current?.length || 0
    });

    // 기존 시작지점 마커가 있는지 확인
    let targetMarker = null;
    if (startEndMarkers.current && startEndMarkers.current.length > 0) {
      targetMarker = startEndMarkers.current[0]; // 첫 번째는 시작지점 마커
      console.log('[showStartPointInfoWindow] 기존 시작지점 마커 사용');
    } else {
      // 마커가 없으면 임시로 위치 기반 InfoWindow 생성
      console.log('[showStartPointInfoWindow] 마커가 없어서 위치 기반 InfoWindow 표시');
    }

    // 시작점 InfoWindow 생성 (모바일 Safari 호환성 강화)
    const startInfoWindow = new window.naver.maps.InfoWindow({
      content: `<style>
        @keyframes slideInFromBottom { 
          0% { opacity: 0; transform: translateY(20px) scale(0.95); } 
          100% { opacity: 1; transform: translateY(0) scale(1); }
        } 
        .info-window-container { 
          animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          -webkit-text-size-adjust: 100% !important;
          -webkit-font-smoothing: antialiased;
        } 
        .close-button { 
          transition: all 0.2s ease;
        } 
        .close-button:hover { 
          background: rgba(0, 0, 0, 0.2) !important; 
          transform: scale(1.1);
        }
        /* 모바일 Safari 텍스트 색상 강제 설정 */
        .info-window-container * {
          color-scheme: light !important;
          -webkit-text-fill-color: initial !important;
        }
      </style><div class="info-window-container" style="
        padding: 12px 16px; 
        min-width: 200px; 
        max-width: 280px; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        background: white !important; 
        border-radius: 12px; 
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
        position: relative;
        color-scheme: light !important;
      "><button class="close-button" onclick="this.parentElement.parentElement.style.display='none'; event.stopPropagation();" style="
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
        color: #666 !important; 
        -webkit-text-fill-color: #666 !important;
      ">×</button><h3 style="
        margin: 0 0 8px 0; 
        font-size: 14px; 
        font-weight: 600; 
        color: #22c55e !important; 
        padding-right: 25px; 
        text-align: center;
        -webkit-text-fill-color: #22c55e !important;
      ">📍 ${memberName}의 시작지점</h3><div style="margin-bottom: 6px;"><p style="
        margin: 0; 
        font-size: 12px; 
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
      ">📅 날짜: <span style="
        color: #111827 !important; 
        font-weight: 500;
        -webkit-text-fill-color: #111827 !important;
      ">${date}</span></p></div><div style="margin-bottom: 0;"><p style="
        margin: 0; 
        font-size: 11px; 
        color: #9ca3af !important;
        -webkit-text-fill-color: #9ca3af !important;
      ">🌍 좌표: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p></div></div>`,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true,
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    // InfoWindow 자동 표시 (마커가 있으면 마커에, 없으면 위치에)
    if (targetMarker) {
      startInfoWindow.open(map.current, targetMarker);
      console.log('[showStartPointInfoWindow] 마커에 InfoWindow 표시 완료');
    } else {
      const LatLng3 = (window as any)?.naver?.maps?.LatLng; if (!LatLng3) return;
      const position = new LatLng3(lat, lng);
      startInfoWindow.open(map.current, position);
      console.log('[showStartPointInfoWindow] 위치에 InfoWindow 표시 완료');
    }

    console.log('[showStartPointInfoWindow] 시작지점 InfoWindow 자동 표시 완료:', {
      memberName, date, position: { lat, lng }, hasMarker: !!targetMarker
    });
  };

  // 위치 로그 데이터 로딩 함수 (새로운 3개 API 포함)
  const loadLocationData = async (mtIdx: number, date: string) => {
    console.log(`[loadLocationData] 🎯 함수 호출됨: mtIdx=${mtIdx}, date=${date}`);

    if (!mtIdx || !date) {
      console.log('[loadLocationData] ❌ 필수 조건 미충족 - 실행 중단:', { mtIdx, date });
      return;
    }

    // 지도가 없어도 데이터는 로드하고, 지도 렌더링은 나중에 처리
    const hasMap = !!map.current;
    console.log(`[loadLocationData] ✅ 데이터 로딩 시작 (지도 상태: ${hasMap ? '준비됨' : '대기중'})`);

    // 캐시에서 먼저 확인 (멤버별로 구분하여 확인)
    if (selectedGroupId) {
      // WebKit 환경에서 금일 날짜 보정 - 과거 날짜는 보정하지 않음
      let adjustedDate = date;
      const todayString = getTodayDateString();
      const isRequestingToday = date === format(new Date(), 'yyyy-MM-dd') || date === todayString;

      if (isWebKitEnv && isRequestingToday) {
        adjustedDate = todayString;
        console.log('[loadLocationData] WebKit 환경 금일 날짜 보정 (오늘만):', {
          원본요청날짜: date,
          보정된날짜: adjustedDate,
          오늘날짜: todayString
        });
      }

      const cachedLocationData = !DISABLE_CACHE ? getCachedLocationData(selectedGroupId, adjustedDate, mtIdx.toString()) : null;
      const isCacheValid_Location = !DISABLE_CACHE ? isCacheValid('locationData', selectedGroupId, adjustedDate) : false;

      if (cachedLocationData && isCacheValid_Location && !DISABLE_CACHE) {
        console.log(`[loadLocationData] 캐시에서 위치 데이터 사용 (멤버 ${mtIdx}):`, date);
        console.log('[loadLocationData] 📋 캐시 데이터 구조 분석:', {
          캐시전체구조: Object.keys(cachedLocationData),
          mapMarkers: cachedLocationData.mapMarkers?.length || 0,
          locationData: cachedLocationData.locationData?.length || 0,
          dailySummary: cachedLocationData.dailySummary?.length || 0,
          stayTimes: cachedLocationData.stayTimes?.length || 0
        });

        // 캐시된 데이터에서 올바른 필드 사용 (locationData가 실제 마커 데이터일 수 있음)
        const actualMapMarkers = cachedLocationData.mapMarkers || cachedLocationData.locationData || [];
        console.log('[loadLocationData] 🎯 실제 사용할 마커 데이터:', actualMapMarkers.length, '개');

        // 캐시된 데이터를 상태에 설정
        setDailySummaryData(cachedLocationData.dailySummary || []);
        setStayTimesData(cachedLocationData.stayTimes || []);
        setMapMarkersData(actualMapMarkers);
        setLocationLogSummaryData(cachedLocationData.locationLogSummary || null);

        // 요약 데이터 계산 및 설정
        const calculatedSummary = calculateLocationStats(actualMapMarkers);
        setLocationSummary(calculatedSummary);

        // 캐시된 데이터로 지도 렌더링
        console.log('[loadLocationData] 캐시된 데이터로 지도 렌더링 시작:', {
          actualMapMarkers: actualMapMarkers.length,
          stayTimes: cachedLocationData.stayTimes?.length || 0,
          mapReady: !!map.current,
          naverMapsReady: !!window.naver?.maps
        });

        // 캐시 데이터를 사용할 때도 더 확실한 지도 렌더링 보장  
        const renderCachedDataOnMap = async () => {
          if (!map.current || !window.naver?.maps) {
            console.warn('[loadLocationData] 지도 미준비 - 지도 렌더링 대기');
            // 지도가 준비될 때까지 짧은 간격으로 재시도 (최대 3초)
            let attempts = 0;
            const maxAttempts = 15; // 200ms * 15 = 3초

            const waitForMap = () => {
              setTimeout(() => {
                attempts++;
                if (map.current && window.naver?.maps) {
                  console.log('[loadLocationData] 지도 준비 완료 - 캐시 데이터 렌더링 진행');
                  renderCachedDataOnMap(); // 재귀 호출
                } else if (attempts < maxAttempts) {
                  waitForMap(); // 재시도
                } else {
                  console.error('[loadLocationData] 지도 대기 시간 초과 - 캐시 데이터 렌더링 포기');
                }
              }, 200);
            };

            waitForMap();
            return;
          }

          if (actualMapMarkers.length === 0) {
            console.warn('[loadLocationData] 캐시된 마커 데이터 없음 - 지도 정리만 수행');
            clearMapMarkersAndPaths(true);
            setIsLocationDataLoading(false);
            setIsMapLoading(false);
            return;
          }

          try {
            console.log('[loadLocationData] 🗺️ 캐시 데이터 지도 렌더링 실행 - 마커 개수:', actualMapMarkers.length);

            await renderLocationDataOnMap(
              actualMapMarkers,
              cachedLocationData.stayTimes || [],
              cachedLocationData.locationLogSummary,
              groupMembers,
              map.current
            );
            console.log('[loadLocationData] ✅ 캐시된 데이터 지도 렌더링 완료');

            // 렌더링 완료 후 지도 새로고침
            if (map.current) {
              map.current.refresh(true);
              console.log('[loadLocationData] 🔄 캐시 데이터 지도 새로고침 완료');
            }

          } catch (renderError) {
            console.error('[loadLocationData] ❌ 캐시 데이터 지도 렌더링 오류:', renderError);
          } finally {
            // 렌더링 완료 또는 실패 시 모든 로딩 상태 해제
            setIsLocationDataLoading(false);
            setIsMapLoading(false);
            // 캐시 데이터 로딩 완료 햅틱 피드백
            hapticFeedback.dataLoadComplete();
            console.log('[loadLocationData] 🔄 캐시 데이터 렌더링 완료 - 모든 로딩 상태 해제');
          }
        };

        // 상태 업데이트 완료 후 렌더링
        setTimeout(() => {
          renderCachedDataOnMap();
        }, 100); // 100ms 지연

        setIsLocationDataLoading(false);
        return;
      }
    }

    // 중복 실행 방지 및 이전 요청 취소 (멤버별 구분)
    const executionKey = `${mtIdx}-${date}`;
    const currentTime = Date.now();

    // 동일한 요청이 이미 실행 중인 경우 건너뛰기
    if (loadLocationDataExecutingRef.current.executing && loadLocationDataExecutingRef.current.currentRequest === executionKey) {
      console.log(`[loadLocationData] 🔄 동일한 요청이 이미 실행 중 - 건너뛰기: ${executionKey}`);
      return;
    }

    // 다른 멤버의 요청이 실행 중인 경우 기존 요청 완료 대기 (과도한 취소 방지)
    if (loadLocationDataExecutingRef.current.executing && loadLocationDataExecutingRef.current.currentRequest !== executionKey) {
      const existingRequest = loadLocationDataExecutingRef.current.currentRequest;
      console.log(`[loadLocationData] ⏳ 다른 요청 진행 중 - 완료 대기: ${existingRequest} (새 요청: ${executionKey})`);

      // 기존 요청이 5초 이상 지속되는 경우에만 취소
      const waitStart = Date.now();
      while (loadLocationDataExecutingRef.current.executing &&
        loadLocationDataExecutingRef.current.currentRequest === existingRequest &&
        Date.now() - waitStart < 5000) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms마다 확인
      }

      // 5초 후에도 진행 중이면 강제 취소
      if (loadLocationDataExecutingRef.current.executing &&
        loadLocationDataExecutingRef.current.currentRequest === existingRequest) {
        console.log(`[loadLocationData] 🛑 5초 초과 - 이전 요청 강제 취소: ${existingRequest}`);
        loadLocationDataExecutingRef.current.cancelled = true;
        loadLocationDataExecutingRef.current.executing = false;
        loadLocationDataExecutingRef.current.currentRequest = undefined;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 새로운 요청 시작
    loadLocationDataExecutingRef.current.executing = true;
    loadLocationDataExecutingRef.current.currentRequest = executionKey;
    loadLocationDataExecutingRef.current.lastExecution = currentTime;
    loadLocationDataExecutingRef.current.cancelled = false;
    console.log(`[loadLocationData] 🚀 새 요청 시작: ${executionKey}-${currentTime}`);

    // 로딩 상태는 handleMemberSelect에서 이미 설정되었으므로 여기서는 설정하지 않음
    console.log('[loadLocationData] 위치 데이터 로딩 시작:', { mtIdx, date });

    try {
      // 요청 시작 전 한 번 더 취소 상태 확인
      if (loadLocationDataExecutingRef.current.cancelled) {
        console.log(`[loadLocationData] 🚫 요청 시작 전 취소됨: ${executionKey}`);
        return;
      }

      // 강화된 API 호출 로직 - 개별 호출로 변경하여 더 정확한 에러 추적
      console.log('[loadLocationData] 🎯 강화된 API 호출 시작');

      // WebKit 환경에서 API 호출용 날짜 정규화 - 과거 날짜는 정규화하지 않음
      let apiDate = date;
      const todayString = getTodayDateString();
      const isRequestingToday = date === format(new Date(), 'yyyy-MM-dd') || date === todayString;

      // 과거 날짜는 정규화하지 않고 원본 날짜 사용
      if (isWebKitEnv && isRequestingToday) {
        apiDate = todayString;
        console.log('[loadLocationData] WebKit API 호출 날짜 정규화 (오늘만):', {
          원본날짜: date,
          정규화날짜: apiDate,
          금일날짜: todayString,
          isWebKit: isWebKitEnv,
          isIOSWebView: isIOSWebViewEnv
        });
      }

      let mapMarkers: MapMarker[] = [];
      let stayTimes: StayTime[] = [];
      let hasAnyApiSuccess = false;

      // WebKit 환경에 따른 타임아웃 설정 최적화
      const coreApiTimeout = isWebKitEnv ? (isIOSWebViewEnv ? 20000 : 25000) : 15000; // WebKit: 20-25초, 일반: 15초
      const auxiliaryApiTimeout = isWebKitEnv ? (isIOSWebViewEnv ? 15000 : 20000) : 10000; // WebKit: 15-20초, 일반: 10초

      console.log('[loadLocationData] WebKit 최적화 타임아웃 설정:', {
        isWebKit: isWebKitEnv,
        isIOSWebView: isIOSWebViewEnv,
        coreTimeout: coreApiTimeout,
        auxiliaryTimeout: auxiliaryApiTimeout
      });

      // 1. getMapMarkers API 호출 (핵심 API) - 재시도 로직 적용
      try {
        console.log('[loadLocationData] 📍 getMapMarkers 호출 중...');

        mapMarkers = await retryDataFetch(
          async () => {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('getMapMarkers API 타임아웃 (15초)')), coreApiTimeout);
            });

            return await Promise.race([
              memberLocationLogService.getMapMarkers(mtIdx, apiDate),
              timeoutPromise
            ]) as MapMarker[];
          },
          'MAP_MARKERS'
        );

        console.log('[loadLocationData] ✅ getMapMarkers 성공:', {
          count: mapMarkers?.length || 0,
          firstMarker: mapMarkers?.[0]
        });
        hasAnyApiSuccess = true;

      } catch (mapMarkersError: any) {
        console.error('[loadLocationData] ❌ getMapMarkers 실패:', {
          error: mapMarkersError,
          errorMessage: mapMarkersError?.message,
          errorStatus: mapMarkersError?.response?.status,
          errorData: mapMarkersError?.response?.data
        });
        mapMarkers = [];
        // getMapMarkers 실패해도 계속 진행 (stayTimes만으로도 부분 표시 가능)
      }

      // 2. getStayTimes API 호출 (핵심 API) - 재시도 로직 적용
      try {
        console.log('[loadLocationData] ⏱️ getStayTimes 호출 중...');

        stayTimes = await retryDataFetch(
          async () => {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('getStayTimes API 타임아웃 (15초)')), coreApiTimeout);
            });

            return await Promise.race([
              memberLocationLogService.getStayTimes(mtIdx, apiDate),
              timeoutPromise
            ]) as StayTime[];
          },
          'STAY_TIMES'
        );

        console.log('[loadLocationData] ✅ getStayTimes 성공:', {
          count: stayTimes?.length || 0,
          firstStayTime: stayTimes?.[0]
        });
        hasAnyApiSuccess = true;

      } catch (stayTimesError: any) {
        console.error('[loadLocationData] ❌ getStayTimes 실패:', {
          error: stayTimesError,
          errorMessage: stayTimesError?.message,
          errorStatus: stayTimesError?.response?.status,
          errorData: stayTimesError?.response?.data
        });
        stayTimes = [];
        // getStayTimes 실패해도 계속 진행 (mapMarkers만으로도 부분 표시 가능)
      }

      // 3. 핵심 API 모두 실패 시에만 에러 처리
      if (!hasAnyApiSuccess) {
        console.error('[loadLocationData] 💥 모든 핵심 API 호출 실패');
        throw new Error('핵심 API 호출이 모두 실패했습니다. 네트워크 상태를 확인해주세요.');
      }

      // 4. 부분 성공이라도 데이터가 있으면 진행
      if (mapMarkers.length === 0 && stayTimes.length === 0) {
        console.warn('[loadLocationData] ⚠️ 핵심 API는 성공했지만 데이터가 없음 - 빈 데이터로 진행');
      } else {
        console.log('[loadLocationData] ✅ 사용 가능한 데이터 확인:', {
          mapMarkers: mapMarkers.length,
          stayTimes: stayTimes.length
        });
      }

      // 나머지 API들은 지연 로딩하고 기본값으로 설정
      const logs: any[] = [];
      const summary = null;
      const dailySummary: any[] = [];
      const locationLogSummary = null;

      // 지연 로딩 시작 (1.5초 후) - 각 API별로 독립적으로 처리
      setTimeout(async () => {
        try {
          // 초기 자동 로딩인 경우에는 지연 로딩도 계속 진행 (사용자 경험 향상)
          if (loadLocationDataExecutingRef.current.cancelled || loadLocationDataExecutingRef.current.currentRequest !== executionKey) {
            console.log(`[loadLocationData] 🚫 지연 로딩 시작 전 취소됨: ${executionKey}`);
            return;
          }

          console.log('[loadLocationData] 보조 API 지연 로딩 시작');

          // 각 보조 API를 독립적으로 호출하여 하나가 실패해도 다른 API에 영향 없도록 함
          const auxiliaryApiTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('보조 API 타임아웃 (10초)')), auxiliaryApiTimeout);
          });

          // 보조 API 1: getDailyLocationLogs
          let delayedLogs: any[] = [];
          try {
            delayedLogs = await Promise.race([
              memberLocationLogService.getDailyLocationLogs(mtIdx, date),
              auxiliaryApiTimeoutPromise
            ]) as any[];
            console.log('[loadLocationData] ✅ getDailyLocationLogs 지연 로딩 성공:', delayedLogs.length);
          } catch (err) {
            console.warn('[loadLocationData] ❌ getDailyLocationLogs 지연 로딩 실패:', err);
            delayedLogs = [];
          }

          // 보조 API 2: getDailyLocationSummary
          let delayedSummary: any = null;
          try {
            delayedSummary = await Promise.race([
              memberLocationLogService.getDailyLocationSummary(mtIdx, date),
              auxiliaryApiTimeoutPromise
            ]);
            console.log('[loadLocationData] ✅ getDailyLocationSummary 지연 로딩 성공');
          } catch (err) {
            console.warn('[loadLocationData] ❌ getDailyLocationSummary 지연 로딩 실패:', err);
            delayedSummary = null;
          }

          // 보조 API 3: getDailySummaryByRange
          let delayedDailySummary: any[] = [];
          try {
            delayedDailySummary = await Promise.race([
              memberLocationLogService.getDailySummaryByRange(mtIdx, date, date),
              auxiliaryApiTimeoutPromise
            ]) as any[];
            console.log('[loadLocationData] ✅ getDailySummaryByRange 지연 로딩 성공:', delayedDailySummary.length);
          } catch (err) {
            console.warn('[loadLocationData] ❌ getDailySummaryByRange 지연 로딩 실패:', err);
            delayedDailySummary = [];
          }

          // 보조 API 4: getLocationLogSummary
          let delayedLocationLogSummary: any = null;
          try {
            delayedLocationLogSummary = await Promise.race([
              memberLocationLogService.getLocationLogSummary(mtIdx, date),
              auxiliaryApiTimeoutPromise
            ]);
            console.log('[loadLocationData] ✅ getLocationLogSummary 지연 로딩 성공');
          } catch (err) {
            console.warn('[loadLocationData] ❌ getLocationLogSummary 지연 로딩 실패:', err);
            delayedLocationLogSummary = null;
          }

          // 지연 로딩 완료 후 상태 업데이트 (성공한 데이터만 업데이트)
          if (!loadLocationDataExecutingRef.current.cancelled && loadLocationDataExecutingRef.current.currentRequest === executionKey) {
            console.log('[loadLocationData] 보조 데이터 로딩 완료 - 성공한 데이터만 상태 업데이트');

            if (Array.isArray(delayedLogs) && delayedLogs.length > 0) {
              setCurrentLocationLogs(delayedLogs);
            }

            if (Array.isArray(delayedDailySummary) && delayedDailySummary.length > 0) {
              setDailySummaryData(delayedDailySummary);
            }

            if (delayedLocationLogSummary) {
              setLocationLogSummaryData(delayedLocationLogSummary);
            }
          }
        } catch (auxiliaryError) {
          console.warn('[loadLocationData] 보조 API 지연 로딩 전체 실패 (핵심 기능에는 영향 없음):', auxiliaryError);
        }
      }, 1500); // 1.5초 후 지연 로딩

      // API 응답 완료 후 요청이 여전히 유효한지 확인 (단, 로딩 상태는 항상 해제)
      if (loadLocationDataExecutingRef.current.cancelled || loadLocationDataExecutingRef.current.currentRequest !== executionKey) {
        console.log(`[loadLocationData] 🚫 요청이 취소되었거나 다른 요청으로 대체됨 - 결과 무시하지만 모든 로딩 상태는 해제: ${executionKey}`);
        setIsLocationDataLoading(false); // 로딩 상태 해제하여 스켈레톤 중단
        setIsMapLoading(false); // 지도 로딩 상태도 해제
        return;
      }
      console.log(`[loadLocationData] ✅ API 응답 완료 - 결과 처리 시작: ${executionKey}`);

      // 데이터 검증 및 로깅
      console.log('[loadLocationData] API 응답 데이터 검증:', {
        logs: Array.isArray(logs) ? logs.length : 'null/error',
        summary: summary ? 'ok' : 'null/error',
        dailySummary: Array.isArray(dailySummary) ? dailySummary.length : 'null/error',
        stayTimes: Array.isArray(stayTimes) ? stayTimes.length : 'null/error',
        mapMarkers: Array.isArray(mapMarkers) ? mapMarkers.length : 'null/error',
        locationLogSummary: locationLogSummary ? 'ok' : 'null/error'
      });

      // 기타 데이터 검증 및 기본값 설정
      const validatedData = {
        logs: Array.isArray(logs) ? logs : [],
        summary: summary || null,
        dailySummary: Array.isArray(dailySummary) ? dailySummary : [],
        stayTimes: Array.isArray(stayTimes) ? stayTimes : [],
        mapMarkers: Array.isArray(mapMarkers) ? mapMarkers : [],
        locationLogSummary: locationLogSummary || null
      };

      // 핵심 데이터 검증 로깅
      if (!Array.isArray(mapMarkers) || mapMarkers.length === 0) {
        console.warn('[loadLocationData] 핵심 데이터(mapMarkers)가 비어있거나 유효하지 않음:', {
          isArray: Array.isArray(mapMarkers),
          length: mapMarkers?.length || 0
        });
      }

      console.log('[loadLocationData] 데이터 검증 완료 - 유효한 데이터로 처리 진행');

      // 성공 시 에러 상태 초기화
      setDataError(null);
      setRetryCount(0);

      // 캐시에 저장 (멤버별로 구분하여 저장)
      if (selectedGroupId) {
        const locationDataForCache = {
          mapMarkers: validatedData.mapMarkers,
          stayTimes: validatedData.stayTimes,
          dailySummary: validatedData.dailySummary,
          locationLogSummary: validatedData.locationLogSummary,
          members: groupMembers
        };
        if (!DISABLE_CACHE) {
          setCachedLocationData(selectedGroupId, apiDate, mtIdx.toString(), locationDataForCache);
          console.log(`[loadLocationData] 데이터를 캐시에 저장 (멤버 ${mtIdx}):`, date);
        } else {
          console.log(`[loadLocationData] 📋 LOGS 페이지 - 캐시 저장 건너뛰기 (멤버 ${mtIdx}):`, date);
        }
      }

      // UI 상태 업데이트
      setCurrentLocationLogs(validatedData.logs); // 필요시 사용
      setDailySummaryData(validatedData.dailySummary);
      setStayTimesData(validatedData.stayTimes);
      setMapMarkersData(validatedData.mapMarkers); // 지도 렌더링 함수로 전달
      setLocationLogSummaryData(validatedData.locationLogSummary);

      // 요약 데이터 설정 (마커 데이터 기반 계산 결과 사용)
      const calculatedSummary = calculateLocationStats(validatedData.mapMarkers);
      console.log('[loadLocationData] 마커 데이터 기반 계산 결과:', calculatedSummary);
      console.log('[loadLocationData] 마커 데이터 개수:', validatedData.mapMarkers.length);

      setLocationSummary(calculatedSummary);
      console.log('[loadLocationData] locationSummary 상태 업데이트 완료:', calculatedSummary);

      // 강제 리렌더링을 위한 추가 상태 업데이트
      setTimeout(() => {
        setLocationSummary({ ...calculatedSummary });
        console.log('[loadLocationData] 강제 리렌더링을 위한 추가 상태 업데이트:', calculatedSummary);
      }, 50);

      // 상태 업데이트 후 검증
      setTimeout(() => {
        console.log('[loadLocationData] 상태 업데이트 검증 - 현재 locationSummary:', calculatedSummary);
      }, 150);

      // 모든 데이터가 준비되면 통합 지도 렌더링 함수 호출
      console.log('[loadLocationData] 통합 지도 렌더링 함수 호출 준비');
      console.log('[loadLocationData] 렌더링 데이터 확인:', {
        mapMarkers: validatedData.mapMarkers.length,
        stayTimes: validatedData.stayTimes.length,
        mapReady: !!map.current,
        naverMapsReady: !!window.naver?.maps
      });

      const currentMembers = groupMembers; // 최신 멤버 상태 전달

      // 신규 데이터 지도 렌더링 (강화된 버전)
      const renderNewDataOnMap = async () => {
        console.log('[loadLocationData] 신규 데이터 지도 렌더링 시작 검증:', {
          mapReady: !!map.current,
          naverMapsReady: !!window.naver?.maps,
          markersCount: validatedData.mapMarkers.length
        });

        if (!map.current || !window.naver?.maps) {
          console.warn('[loadLocationData] 지도 미준비 - 신규 데이터 렌더링 대기');
          // 지도가 준비될 때까지 짧은 간격으로 재시도 (최대 3초)
          let attempts = 0;
          const maxAttempts = 15; // 200ms * 15 = 3초

          const waitForMap = () => {
            setTimeout(() => {
              attempts++;
              if (map.current && window.naver?.maps) {
                console.log('[loadLocationData] 지도 준비 완료 - 신규 데이터 렌더링 진행');
                renderNewDataOnMap(); // 재귀 호출
              } else if (attempts < maxAttempts) {
                waitForMap(); // 재시도
              } else {
                console.error('[loadLocationData] 지도 대기 시간 초과 - 신규 데이터 렌더링 포기');
                setIsLocationDataLoading(false);
                setIsMapLoading(false);
              }
            }, 200);
          };

          waitForMap();
          return;
        }

        if (validatedData.mapMarkers.length === 0) {
          console.warn('[loadLocationData] 신규 마커 데이터 없음 - 지도 정리만 수행');
          clearMapMarkersAndPaths(true);
          setIsLocationDataLoading(false);
          setIsMapLoading(false);
          return;
        }

        try {
          console.log('[loadLocationData] 🗺️ 신규 데이터 지도 렌더링 시작 - 마커 개수:', validatedData.mapMarkers.length);

          await renderLocationDataOnMap(
            validatedData.mapMarkers,
            validatedData.stayTimes,
            validatedData.locationLogSummary,
            currentMembers,
            map.current
          );
          console.log('[loadLocationData] ✅ 통합 지도 렌더링 함수 호출 완료');

          // 렌더링 완료 후 지도 새로고침
          if (map.current) {
            map.current.refresh(true);
            console.log('[loadLocationData] 🔄 지도 새로고침 완료');
          }

        } catch (renderError) {
          console.error('[loadLocationData] ❌ 지도 렌더링 오류:', renderError);
          // 렌더링 실패 시에도 멤버 마커는 표시
          const selectedMember = groupMembers.find(m => m.isSelected);
          if (selectedMember && map.current) {
            updateMemberMarkers([selectedMember], false);
          }
        } finally {
          // 렌더링 완료 또는 실패 시 모든 로딩 상태 해제
          setIsLocationDataLoading(false);
          setIsMapLoading(false);
          // 신규 위치 데이터 로딩 완료 햅틱 피드백
          hapticFeedback.dataLoadComplete();
          console.log('[loadLocationData] 🔄 신규 데이터 렌더링 완료 - 모든 로딩 상태 해제');

          // 렌더링 완료 후 마커 표시 검증 및 재시도 로직
          setTimeout(() => {
            verifyAndRetryMapRendering(validatedData.mapMarkers, validatedData.stayTimes, validatedData.locationLogSummary, currentMembers, mtIdx, date);
          }, 1000); // 1초 후 검증
        }
      };

      // 상태 업데이트 완료 후 렌더링 (finally 블록 이전에 실행)
      setTimeout(() => {
        renderNewDataOnMap();
      }, 50); // 50ms 지연으로 상태 업데이트 완료 대기

    } catch (error: any) {
      console.error('[loadLocationData] 💥 위치 데이터 로딩 오류:', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorStatus: error?.response?.status,
        errorData: error?.response?.data,
        mtIdx,
        date,
        executionKey,
        isOnline: navigator.onLine
      });

      // 네트워크 오류나 타임아웃인 경우 스마트 재시도 (최대 2회로 축소)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('타임아웃') ||
        errorMessage.includes('Network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('핵심 API 호출이 모두 실패') ||
        !navigator.onLine ||
        error?.code === 'NETWORK_ERROR';

      // 재시도 조건을 더 엄격하게 설정 (진짜 네트워크 문제일 때만)
      if (isNetworkError && retryCount < 2 && navigator.onLine) {
        console.log(`[loadLocationData] 🔄 네트워크 오류 감지 - 스마트 재시도 (${retryCount + 1}/2):`, errorMessage);
        setRetryCount(prev => prev + 1);

        // Vercel 환경에서는 더 긴 지연 시간 사용
        const isVercel = typeof window !== 'undefined' &&
          (window.location.hostname.includes('vercel.app') ||
            window.location.hostname.includes('nextstep.smap.site'));

        // 적응적 지연 (Vercel: 첫 번째 3초, 두 번째 8초 / 기타: 첫 번째 2초, 두 번째 5초)
        const retryDelay = isVercel
          ? (retryCount === 0 ? 3000 : 8000)
          : (retryCount === 0 ? 2000 : 5000);

        console.log(`[loadLocationData] ⏰ ${retryDelay}ms 후 재시도 예정 (Vercel: ${isVercel})`);

        setTimeout(() => {
          console.log(`[loadLocationData] 🚀 스마트 재시도 실행 중... (${retryCount + 1}/2)`);
          loadLocationData(mtIdx, date);
        }, retryDelay);
        return;
      }

      // 모든 재시도 실패 또는 네트워크 오류가 아닌 경우
      if (retryCount >= 2) {
        console.error(`[loadLocationData] 💔 모든 재시도 실패 (${retryCount}/2):`, errorMessage);
        const retryFailedError = new Error(
          `데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.`
        );
        handleDataError(retryFailedError, 'loadLocationData-retry-failed');
      } else {
        // 일반 에러 처리 (단, 부분 실패는 허용)
        console.warn('[loadLocationData] ⚠️ 일반 에러 처리 - 부분 데이터라도 표시 시도');
        handleDataError(error, 'loadLocationData');
      }

      // 오류 시 기본값으로 설정 및 지도 정리
      setCurrentLocationLogs([]);
      setLocationSummary(DEFAULT_LOCATION_SUMMARY);
      setDailySummaryData([]);
      setStayTimesData([]);
      // 완전 실패 시에만 마커 데이터 초기화 (부분 성공은 유지)
      setMapMarkersData([]);
      setLocationLogSummaryData(null);
      setSortedLocationData([]);

      // 오류 발생 시에도 멤버 아이콘은 표시되도록 지도 정리 후 멤버 마커만 다시 그림
      if (map.current) {
        console.log('[loadLocationData] 오류 발생 - 지도 정리 후 멤버 아이콘만 다시 그림');
        clearMapMarkersAndPaths(true); // 전체 정리
        const selectedMember = groupMembers.find(m => m.isSelected);
        if (selectedMember) {
          try {
            const lat = selectedMember.mlt_lat !== null && selectedMember.mlt_lat !== undefined && selectedMember.mlt_lat !== 0 ? parseFloat(selectedMember.mlt_lat.toString()) : parseFloat(selectedMember.location.lat.toString() || '37.5665');
            const lng = selectedMember.mlt_long !== null && selectedMember.mlt_long !== undefined && selectedMember.mlt_long !== 0 ? parseFloat(selectedMember.mlt_long.toString()) : parseFloat(selectedMember.location.lng.toString() || '126.9780');
            const LatLng4 = (window as any)?.naver?.maps?.LatLng; if (!LatLng4) return;
            const position = new LatLng4(lat, lng);
            const safeImageUrl = getSafeImageUrl(selectedMember.photo, selectedMember.mt_gender, selectedMember.original_index);
            const marker = new window.naver.maps.Marker({
              position: position,
              map: map.current,
              icon: { content: `<div style="position: relative; text-align: center;"><div style="width: 32px; height: 32px; background-color: white; border: 2px solid #EC4899; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"><img src="${safeImageUrl}" alt="${selectedMember.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${getDefaultImage(selectedMember.mt_gender, selectedMember.original_index)}'" /></div><div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">${selectedMember.name}</div></div>`, size: new window.naver.maps.Size(36, 48), anchor: new window.naver.maps.Point(18, 42) }, zIndex: 200
            });
            memberNaverMarkers.current = [marker];
            map.current.setCenter(position); // 멤버 위치로 지도 이동
            map.current.setZoom(16); // 줌 레벨 설정
            map.current.refresh(true);
            console.log('[loadLocationData] 오류 시 멤버 아이콘 표시 및 지도 이동 완료');
          } catch (e) { console.error('[loadLocationData] 오류 시 멤버 마커 생성 실패:', e); }
        }
      }

    } finally {
      // 지연된 상태 정리 (렌더링 완료 후 정리)
      setTimeout(() => {
        console.log(`[loadLocationData] 🔄 Finally 블록 - 지연된 상태 정리 시작: ${executionKey}`);

        // 실행 상태 정리
        loadLocationDataExecutingRef.current.executing = false;
        loadLocationDataExecutingRef.current.currentRequest = undefined;
        loadLocationDataExecutingRef.current.cancelled = false; // 항상 false로 리셋

        console.log(`[loadLocationData] 🔄 모든 상태 정리 완료: ${executionKey}`);

        // 성공적으로 완료된 경우 마지막 로딩된 멤버 정보 업데이트
        if (!loadLocationDataExecutingRef.current.cancelled) {
          lastLoadedMemberRef.current = mtIdx.toString();
          console.log(`[loadLocationData] 마지막 로딩된 멤버 업데이트: ${mtIdx}`);
        }

        console.log(`[loadLocationData] 🎉 모든 처리 및 실행 완료: ${executionKey}-${currentTime}`);

        // 날짜 변경 플래그 리셋 (loadLocationData 완료 시점에 리셋)
        if (isDateChangingRef.current) {
          isDateChangingRef.current = false;
          console.log('[loadLocationData] 날짜 변경 플래그 리셋');
        }

        // 사용자 날짜 선택 플래그는 멤버 선택에서만 리셋하도록 변경
        // (loadLocationData에서는 리셋하지 않음)
        console.log('[loadLocationData] 사용자 날짜 선택 플래그 유지 (멤버 선택에서만 리셋)');
      }, 500); // 500ms 지연으로 렌더링 완료 후 정리
    }
  };

  // 시간을 포맷하는 헬퍼 함수
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  };

  // 두 좌표 간의 거리 계산 (Haversine 공식)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 지구 반지름(미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 미터 단위
  };

  // 마커 데이터로부터 이동거리, 이동시간, 걸음수 계산 (걸음수는 마지막 마커의 mt_health_work 사용)
  const calculateLocationStats = (locationData: any[]): { distance: string; time: string; steps: string } => {
    // console.log('[calculateLocationStats] 입력 데이터 확인:', {
    //   hasData: !!locationData,
    //   dataLength: locationData?.length || 0,
    //   firstItem: locationData?.[0],
    //   lastItem: locationData?.[locationData?.length - 1]
    // });

    if (!locationData || locationData.length === 0) {
      // console.log('[calculateLocationStats] 데이터 없음 - 기본값 반환');
      return { distance: '0 km', time: '0분', steps: '0 걸음' };
    }

    // 시간 순으로 정렬
    const sortedData = [...locationData].sort((a, b) => {
      const timeA = a.timestamp || a.mlt_gps_time || '';
      const timeB = b.timestamp || b.mlt_gps_time || '';
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    let totalDistance = 0;
    let movingTimeSeconds = 0;
    let validSegments = 0;

    // console.log('[calculateLocationStats] 거리/시간 계산 시작:', {
    //   totalMarkers: sortedData.length,
    //   firstMarker: {
    //     timestamp: sortedData[0].timestamp || sortedData[0].mlt_gps_time,
    //     lat: sortedData[0].latitude || sortedData[0].mlt_lat,
    //     lng: sortedData[0].longitude || sortedData[0].mlt_long
    //   }
    // });

    // 이동거리와 실제 이동시간 계산 (체류시간 제외)
    for (let i = 1; i < sortedData.length; i++) {
      const prev = sortedData[i - 1];
      const curr = sortedData[i];

      const prevLat = prev.latitude || prev.mlt_lat;
      const prevLng = prev.longitude || prev.mlt_long;
      const currLat = curr.latitude || curr.mlt_lat;
      const currLng = curr.longitude || curr.mlt_long;

      if (prevLat && prevLng && currLat && currLng) {
        const distance = calculateDistance(prevLat, prevLng, currLat, currLng);

        // 오차 데이터 필터링 (1km 이상 점프는 제외)
        if (distance < 1000) {
          totalDistance += distance;
          validSegments++;

          // 이동시간 계산 - 실제로 움직인 구간만 계산
          const prevTime = new Date(prev.timestamp || prev.mlt_gps_time || '').getTime();
          const currTime = new Date(curr.timestamp || curr.mlt_gps_time || '').getTime();

          if (!isNaN(prevTime) && !isNaN(currTime)) {
            const segmentTimeSeconds = (currTime - prevTime) / 1000;
            const segmentTimeHours = segmentTimeSeconds / 3600;
            const speedMs = curr.speed || curr.mlt_speed || 0; // m/s
            const speedKmh = speedMs * 3.6; // km/h로 변환

            // 이동 판정 조건:
            // 1. 거리가 10미터 이상 변화했거나
            // 2. 속도가 0.5km/h 이상인 경우를 이동으로 간주
            const isMoving = distance >= 10 || speedKmh >= 0.5;

            // 5분(300초) 이상 차이나는 구간은 이동시간에서 제외
            if (segmentTimeSeconds >= 300) {
              // console.log('[calculateLocationStats] 1시간 이상 구간 제외:', {
              //   prevTime: new Date(prev.timestamp || prev.mlt_gps_time || '').toISOString(),
              //   currTime: new Date(curr.timestamp || curr.mlt_gps_time || '').toISOString(),
              //   segmentTimeHours: segmentTimeHours.toFixed(2) + '시간',
              //   distance: distance.toFixed(2) + 'm',
              //   reason: '시간 간격이 1시간 이상'
              // });
            } else if (isMoving && segmentTimeSeconds > 0) {
              movingTimeSeconds += segmentTimeSeconds;
              // console.log('[calculateLocationStats] 이동시간 추가:', {
              //   segmentTimeSeconds: segmentTimeSeconds.toFixed(1) + '초',
              //   distance: distance.toFixed(2) + 'm',
              //   speedKmh: speedKmh.toFixed(1) + 'km/h',
              //   totalMovingTime: (movingTimeSeconds / 60).toFixed(1) + '분'
              // });
            }
          }
        }
      }
    }

    // 걸음수는 가장 큰 값을 가진 마커의 걸음수 데이터 사용 (다양한 필드명 시도)
    let actualSteps = 0;

    if (sortedData.length > 0) {
      console.log('[calculateLocationStats] 걸음수 데이터 탐색 시작 - 마커 개수:', sortedData.length);

      // 가능한 걸음수 필드명들
      const stepFields = ['mt_health_work', 'health_work', 'steps', 'mt_steps', 'step_count', 'daily_steps'];

      // 모든 마커에서 가장 큰 걸음수 값 찾기
      for (const data of sortedData) {
        for (const field of stepFields) {
          const value = data[field];
          if (value && typeof value === 'number' && value > actualSteps) {
            actualSteps = value;
            // console.log('[calculateLocationStats] 더 큰 걸음수 발견:', {
            //   field: field,
            //   value: value,
            //   timestamp: data.timestamp || data.mlt_gps_time
            // });
          }
        }
      }

      if (actualSteps > 0) {
        console.log('[calculateLocationStats] 최종 걸음수 데이터 사용:', {
          finalSteps: actualSteps,
          totalMarkers: sortedData.length
        });
      } else {
        console.log('[calculateLocationStats] 모든 마커에서 걸음수 데이터를 찾을 수 없음');

        // 디버깅을 위해 첫 번째와 마지막 마커의 모든 필드 출력
        // console.log('[calculateLocationStats] 디버깅 - 첫 번째 마커 데이터:', sortedData[0]);
        // console.log('[calculateLocationStats] 디버깅 - 마지막 마커 데이터:', sortedData[sortedData.length - 1]);
      }
    }

    // 포맷팅
    const distanceKm = (totalDistance / 1000).toFixed(1);
    const timeFormatted = formatTime(movingTimeSeconds);
    const stepsFormatted = actualSteps.toLocaleString();

    // console.log('[calculateLocationStats] 계산 결과:', {
    //   totalDistance: totalDistance,
    //   distanceKm: distanceKm,
    //   movingTimeSeconds: movingTimeSeconds,
    //   timeFormatted: timeFormatted,
    //   actualSteps: actualSteps,
    //   dataPoints: sortedData.length,
    //   validSegments: validSegments,
    //   note: '마커 데이터 기반 이동거리/시간 계산, 모든 마커에서 최대 걸음수 사용'
    // });

    // 데이터가 전부 0인 경우 추가 진단
    // if (totalDistance === 0 && movingTimeSeconds === 0 && actualSteps === 0) {
    //   console.warn('[calculateLocationStats] ⚠️ 모든 값이 0 - 추가 진단 필요');
    //   console.log('[calculateLocationStats] 상세 진단:', {
    //     hasValidCoordinates: sortedData.some(d => (d.latitude || d.mlt_lat) && (d.longitude || d.mlt_long)),
    //     hasValidTimestamps: sortedData.some(d => d.timestamp || d.mlt_gps_time),
    //     sampleMarkers: sortedData.slice(0, 3)
    //   });
    // }

    return {
      distance: `${distanceKm} km`,
      time: timeFormatted,
      steps: `${stepsFormatted} 걸음`
    };
  };

  // 슬라이더 이벤트 핸들러들
  const handleSliderStart = (e: React.TouchEvent | React.MouseEvent) => {
    // 이벤트 전파 차단하여 상위 스와이프 동작 방지
    e.stopPropagation();
    e.preventDefault();

    setIsSliderDragging(true);
    updateSliderValue(e);

    // 기존 이벤트 리스너가 있다면 먼저 제거
    const cleanup = () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };

    // 글로벌 이벤트 리스너 추가 (드래그가 슬라이더 영역을 벗어나도 추적)
    const handleGlobalMove = (globalE: MouseEvent | TouchEvent) => {
      if (!isSliderDragging) {
        cleanup();
        return;
      }
      updateSliderValue(globalE);
    };

    const handleGlobalEnd = () => {
      setIsSliderDragging(false);
      cleanup();
      console.log('[슬라이더] 드래그 종료');
    };

    // 기존 리스너 정리 후 새로 추가
    cleanup();
    document.addEventListener('mousemove', handleGlobalMove, { passive: false });
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchmove', handleGlobalMove, { passive: false });
    document.addEventListener('touchend', handleGlobalEnd);

    console.log('[슬라이더] 드래그 시작 - 글로벌 이벤트 리스너 추가');
  };

  const handleSliderMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSliderDragging) return;

    // 드래그 중일 때도 이벤트 전파 차단
    e.stopPropagation();
    e.preventDefault();

    updateSliderValue(e);
  };

  const handleSliderEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    setIsSliderDragging(false);
    console.log('[슬라이더] 드래그 종료');
  };

  // 슬라이더 업데이트 최적화를 위한 변수들
  const lastUpdateTimeRef = useRef<number>(0);
  const updateThrottleMs = 16; // 60fps = 16.67ms 간격 (requestAnimationFrame 기반)
  const animationFrameRef = useRef<number | null>(null);
  const lastSliderValueRef = useRef<number>(0);

  // 지도 중심 이동 최적화를 위한 변수들
  const lastMapCenterRef = useRef<{ lat: number, lng: number } | null>(null);
  const mapUpdateThresholdM = 10; // 10m 이상 이동시에만 지도 중심 변경

  // 두 좌표 간의 거리 계산 (미터 단위)
  const calculateDistanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 컴포넌트 언마운트시 애니메이션 프레임 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const updateSliderValue = (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => {
    if (!sliderRef.current || !isSliderDragging) return;

    // 이전 애니메이션 프레임 취소
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // requestAnimationFrame을 사용한 부드러운 업데이트
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!sliderRef.current || !isSliderDragging) return;

      // 성능 최적화: throttling 적용 (60fps 제한)
      const now = performance.now();
      if (now - lastUpdateTimeRef.current < updateThrottleMs) return;
      lastUpdateTimeRef.current = now;

      try {
        const rect = sliderRef.current.getBoundingClientRect();
        let clientX: number;

        // 이벤트 타입에 따라 clientX 추출
        if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
        } else if ('changedTouches' in e && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
        } else {
          clientX = (e as MouseEvent).clientX;
        }

        // 유효하지 않은 clientX 값 체크
        if (isNaN(clientX) || !isFinite(clientX)) return;

        // 간단한 퍼센트 기반 슬라이더 계산
        const relativeX = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));

        // 유효하지 않은 percentage 값 체크
        if (isNaN(percentage) || !isFinite(percentage)) return;

        // 임계값 증가: 0.05% → 0.5%로 변경하여 불필요한 업데이트 감소
        const previousValue = lastSliderValueRef.current;
        if (Math.abs(percentage - previousValue) < 0.5) return;
        lastSliderValueRef.current = percentage;

        // 햅틱 피드백 최적화: 5% → 10% 이상 변경시에만 실행
        if (Math.abs(percentage - previousValue) >= 10) {
          hapticFeedback.sliderMove();
        }

        // 상태 업데이트 (React의 배치 처리에 맡김)
        setSliderValue(percentage);

        // 경로 진행률 업데이트 (즉시 실행)
        updatePathProgress(percentage);
      } catch (error) {
        console.error('[updateSliderValue] 에러 발생:', error);
      }
    });
  };

  // InfoWindow 내용 생성 함수 (성능 최적화를 위해 분리)
  const createInfoWindowContent = (targetIndex: number, totalMarkers: number, currentMarkerData: any): string => {
    if (!currentMarkerData) return '<div>데이터 없음</div>';

    // 마커 데이터에서 정보 추출
    const speedMs = currentMarkerData.speed || currentMarkerData.mlt_speed || 0; // m/s
    const speed = speedMs * 3.6; // m/s를 km/h로 변환
    const accuracy = currentMarkerData.accuracy || currentMarkerData.mlt_accuacy || 0;
    const battery = currentMarkerData.battery_level || currentMarkerData.mlt_battery || 0;
    const timestamp = currentMarkerData.timestamp || currentMarkerData.mlt_gps_time || '정보 없음';

    // 시간에서 날짜 부분 제거 (시간만 표시)
    const timeOnly = timestamp === '정보 없음' ? '정보 없음' :
      timestamp.includes('T') ? timestamp.split('T')[1]?.substring(0, 8) || timestamp :
        timestamp.includes(' ') ? timestamp.split(' ')[1] || timestamp :
          timestamp;

    // 속도에 따른 이동 수단 아이콘 결정 (지도 마커와 동일한 로직)
    const getTransportIcon = (speed: number) => {
      if (speed >= 30) return '🚗'; // 30km/h 이상: 자동차
      else if (speed >= 15) return '🏃'; // 15-30km/h: 달리기/자전거
      else if (speed >= 3) return '🚶'; // 3-15km/h: 걷기
      else if (speed >= 1) return '🧍'; // 1-3km/h: 천천히 걷기
      else return '⏸️'; // 1km/h 미만: 정지
    };

    const getTransportText = (speed: number) => {
      if (speed >= 30) return '차량 이동';
      else if (speed >= 15) return '빠른 이동';
      else if (speed >= 3) return '걷기';
      else if (speed >= 1) return '천천히 이동';
      else return '정지 상태';
    };

    const transportIcon = getTransportIcon(speed);
    const transportText = getTransportText(speed);

    // InfoWindow 내용 생성 (모바일 Safari 호환성 강화 + GPU 가속)
    return `
      <style>
        /* 모바일 Safari 텍스트 색상 강제 설정 */
        .current-position-info * {
          color-scheme: light !important;
          -webkit-text-fill-color: initial !important;
          -webkit-text-size-adjust: 100% !important;
        }
      </style>
      <div class="current-position-info" style="
        padding: 8px;
        background: white !important;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-width: 140px;
        max-width: 160px;
        color-scheme: light !important;
        /* GPU 가속 최적화 */
        transform: translateZ(0);
        will-change: auto;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white !important;
          padding: 4px 6px;
          border-radius: 4px;
          margin: -8px -8px 6px -8px;
          font-weight: 600;
          font-size: 11px;
          text-align: center;
          -webkit-text-fill-color: white !important;
        ">
          ${targetIndex + 1} / ${totalMarkers}
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(59, 130, 246, 0.1); padding: 2px 4px; border-radius: 4px; margin: 2px 0;">
            <span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">이동 수단:</span>
            <span style="font-weight: 600; font-size: 11px; display: flex; align-items: center; gap: 2px;">
              ${transportIcon} <span style="font-size: 9px; color: #3b82f6 !important; -webkit-text-fill-color: #3b82f6 !important;">${transportText}</span>
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">⏰ 시간:</span>
            <span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${timeOnly}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">🚀 속도:</span>
            <span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${speed.toFixed(1)}km/h</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">📍 정확도:</span>
            <span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${accuracy.toFixed(0)}m</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">🔋 배터리:</span>
            <span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${battery}%</span>
          </div>
        </div>
      </div>
    `;
  };

  // 현재 위치 마커 생성/업데이트 함수 (성능 최적화 - 객체 재사용)
  const createOrUpdateCurrentPositionMarker = (lat: number, lng: number, targetIndex: number, totalMarkers: number) => {
    if (!map.current || !window.naver?.maps) return;

    const LatLng5 = (window as any)?.naver?.maps?.LatLng; if (!LatLng5) return;
    const position = new LatLng5(lat, lng);

    // 현재 마커 데이터 가져오기
    const currentMarkerData = sortedLocationData[targetIndex];
    if (!currentMarkerData) return;

    // InfoWindow 내용 생성
    const infoContent = createInfoWindowContent(targetIndex, totalMarkers, currentMarkerData);

    // 마커 아이콘 HTML 생성 (동적 내용 포함)
    const iconHtml = `
      <div style="
        width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(239,68,68,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        animation: pulse 2s infinite;
        /* GPU 가속 최적화 */
        transform: translateZ(0);
        will-change: transform, box-shadow;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          transform: translateZ(0);
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(239,68,68,0.2); transform: translateZ(0) scale(1); }
          50% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 8px rgba(239,68,68,0.1); transform: translateZ(0) scale(1.05); }
          100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(239,68,68,0.2); transform: translateZ(0) scale(1); }
        }
      </style>
    `;

    // 기존 마커가 있다면 업데이트 (객체 재사용)
    if (currentPositionMarker.current) {
      // 1. 위치 업데이트
      currentPositionMarker.current.setPosition(position);

      // 2. 아이콘 업데이트 (필요한 경우만 하거나 매번 해도 DOM 조작보다 가벼움)
      // 현재는 아이콘이 정적이므로 위치만 옮겨도 되지만, 펄스 애니메이션 재시작 등을 위해 업데이트할 수 있음.
      // 하지만 성능을 위해 위치만 옮기는 것이 가장 빠름. 여기서는 아이콘이 동일하므로 setIcon 생략 가능 여부 체크.
      // 만약 아이콘 내부에 숫자가 들어간다면 setIcon 필수. 현재는 숫자 없음. -> setIcon 생략 가능할수도 있지만 안전하게 업데이트.
      // currentPositionMarker.current.setIcon({
      //   content: iconHtml,
      //   anchor: new window.naver.maps.Point(12, 12)
      // });

      // 3. 타이틀 업데이트
      currentPositionMarker.current.setTitle(`현재 위치 (${targetIndex + 1}/${totalMarkers})`);

      // 4. InfoWindow 내용 업데이트
      if (currentPositionMarker.current.infoWindow) {
        currentPositionMarker.current.infoWindow.setContent(infoContent);
        // InfoWindow 위치가 마커를 따라가지 않는 경우를 대비해 위치 강제 업데이트가 필요할 수 있음
        // 하지만 InfoWindow는 마커에 바인딩되어 있으면 보통 따라감.
        // 만약 안 따라간다면 open 다시 호출
        if (!currentPositionMarker.current.infoWindow.getMap()) {
          currentPositionMarker.current.infoWindow.open(map.current, currentPositionMarker.current);
        }
      }

      return; // 업데이트 완료 후 리턴
    }

    // 기존 마커가 없다면 새로 생성
    currentPositionMarker.current = new window.naver.maps.Marker({
      position: position,
      map: map.current,
      title: `현재 위치 (${targetIndex + 1}/${totalMarkers})`,
      icon: {
        content: iconHtml,
        anchor: new window.naver.maps.Point(12, 12)
      },
      zIndex: 1000 // 가장 위에 표시
    });

    // InfoWindow 생성 및 표시
    const infoWindow = new window.naver.maps.InfoWindow({
      content: infoContent,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      anchorSize: new window.naver.maps.Size(0, 0),
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    // InfoWindow 즉시 표시
    infoWindow.open(map.current, currentPositionMarker.current);

    // 마커에 InfoWindow 참조 저장 (정리할 때 함께 제거하기 위해)
    currentPositionMarker.current.infoWindow = infoWindow;
  };

  // 슬라이더 값에 따라 경로 진행 상황 업데이트
  const updatePathProgress = (percentage: number) => {
    if (!map.current || sortedLocationData.length === 0) return;

    const totalMarkers = sortedLocationData.length;
    // 슬라이더 값을 직접 사용 (0% = 시작점, 100% = 종료점)
    const currentIndex = Math.floor((percentage / 100) * totalMarkers);
    const targetIndex = Math.min(currentIndex, totalMarkers - 1);

    if (targetIndex >= 0 && sortedLocationData[targetIndex]) {
      const targetMarker = sortedLocationData[targetIndex];
      const lat = targetMarker.latitude || targetMarker.mlt_lat || 0;
      const lng = targetMarker.longitude || targetMarker.mlt_long || 0;

      if (lat && lng) {
        // 1. 마커를 먼저 생성/업데이트 (항상 실행)
        createOrUpdateCurrentPositionMarker(Number(lat), Number(lng), targetIndex, totalMarkers);

        // 2. 지도 중심 이동 최적화: 거리 기반 업데이트
        const shouldUpdateMapCenter = !lastMapCenterRef.current ||
          calculateDistanceInMeters(
            lastMapCenterRef.current.lat,
            lastMapCenterRef.current.lng,
            Number(lat),
            Number(lng)
          ) > mapUpdateThresholdM;

        if (shouldUpdateMapCenter) {
          const LatLng6 = (window as any)?.naver?.maps?.LatLng; if (!LatLng6) return;
          const center = new LatLng6(Number(lat), Number(lng));
          map.current.setCenter(center);
          // 좌표 계산 캐싱: 이전 중심 좌표 저장
          lastMapCenterRef.current = { lat: Number(lat), lng: Number(lng) };
        }
      }
    }
  };

  // 새로운 API 데이터 디버깅 함수
  const logExecutedRef = useRef(false);

  const logNewApiData = () => {
    if (logExecutedRef.current) return;
    logExecutedRef.current = true;

    console.log('=== 새로운 API 데이터 현황 ===');
    console.log('🗓️ 날짜별 요약 데이터:', dailySummaryData);
    console.log('⏱️ 체류시간 분석 데이터:', stayTimesData);
    console.log('📍 지도 마커 데이터:', mapMarkersData);
    console.log('📝 PHP 로직 기반 요약 데이터:', locationLogSummaryData);

    // 3초 후 플래그 리셋
    setTimeout(() => {
      logExecutedRef.current = false;
    }, 3000);

    // 멤버별 일별 카운트 데이터 로깅
    if (dailyCountsData) {
      console.log('📊 멤버별 일별 카운트 데이터:');
      console.log('  - 전체 멤버:', dailyCountsData.total_members, '명');
      console.log('  - 조회 기간:', dailyCountsData.start_date, '~', dailyCountsData.end_date);

      // 멤버별 상세 일별 카운트 출력
      console.log('  - 멤버별 상세 데이터:'); // 멤버별 상세 데이터 출력
      dailyCountsData.member_daily_counts.forEach((member, index) => {
        console.log(`    ${index + 1}. ${member.member_name} (ID: ${member.member_id}):`);
        member.daily_counts.forEach(dayCount => {
          console.log(`      📅 ${dayCount.formatted_date}: ${dayCount.count}건`);
        });
        const totalCount = member.daily_counts.reduce((sum, day) => sum + day.count, 0);
        console.log(`      🔢 총합: ${totalCount}건`);
        console.log('');
      });

      // 전체 일별 합계 (모든 날짜)
      console.log('  - 전체 일별 합계:');
      dailyCountsData.total_daily_counts.forEach(day => {
        console.log(`    📅 ${day.formatted_date}: ${day.count}건`);
      });

      // 전체 총합
      const grandTotal = dailyCountsData.total_daily_counts.reduce((sum, day) => sum + day.count, 0);
      console.log(`  🔢 총 전체 위치 기록: ${grandTotal}건`);
    } else {
      console.log('📊 일별 카운트 데이터: null');
    }

    console.log('👥 멤버 활동 데이터:', memberActivityData);
    console.log('============================');
  };

  // 일별 위치 기록 카운트 조회 함수
  const loadDailyLocationCounts = async (groupId: number, days: number = 14) => {
    if (isDailyCountsLoading) return;

    setIsDailyCountsLoading(true);
    console.log('[LOGS] 일별 위치 기록 카운트 조회 시작:', { groupId, days });

    try {
      const response = await memberLocationLogService.getDailyLocationCounts(groupId, days);
      setDailyCountsData(response);

      // 캐시에 저장 - LOGS 페이지에서는 캐시 비활성화
      if (!DISABLE_CACHE) {
        setCachedDailyLocationCounts(groupId, response);
      } else {
        console.log('[loadDailyLocationCounts] 📋 LOGS 페이지 - 캐시 저장 건너뛰기');
      }

      console.log('[LOGS] 일별 위치 기록 카운트 조회 완료:', response);

      // 데이터 검증 수행 (비활성화 - 주기적 검증 불필요)
      // if (!isInitialLoading && dataValidationState.lastValidationTime) {
      //   setTimeout(() => {
      //     validateAndResyncData(groupId);
      //   }, 2000);
      // }
    } catch (error) {
      console.error('[LOGS] 일별 위치 기록 카운트 조회 실패:', error);
      handleDataError(error, 'loadDailyLocationCounts');
      setDailyCountsData(null);
    } finally {
      setIsDailyCountsLoading(false);
      // 일별 위치 카운트 로딩 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
    }
  };

  // 데이터 검증 및 재세팅 함수들
  const validateAndResyncData = async (groupId: number, forceResync: boolean = false) => {
    if (dataValidationState.isValidating && !forceResync) {
      console.log('[validateAndResyncData] 이미 검증 중이므로 건너뜀');
      return;
    }

    setDataValidationState(prev => ({ ...prev, isValidating: true }));
    console.log('[validateAndResyncData] 데이터 검증 및 재세팅 시작:', { groupId, forceResync });

    try {
      // 1. 일별 카운트 데이터 검증
      const dailyCountsValidation = await validateDailyCountsData(groupId);

      // 2. 멤버별 활동 데이터 검증
      const memberActivityValidation = await validateMemberActivityData(groupId);

      // 3. 그룹 멤버 데이터 검증
      const groupMembersValidation = await validateGroupMembersData(groupId);

      const allValidations = [dailyCountsValidation, memberActivityValidation, groupMembersValidation];
      const hasErrors = allValidations.some(v => !v.isValid);
      const errors = allValidations.flatMap(v => v.errors);

      if (hasErrors) {
        console.warn('[validateAndResyncData] 데이터 불일치 발견:', errors);

        // 재시도 횟수 확인
        if (dataValidationState.retryCount < 3) {
          console.log('[validateAndResyncData] 데이터 재세팅 시도:', dataValidationState.retryCount + 1);
          await resyncAllData(groupId);

          setDataValidationState(prev => ({
            ...prev,
            retryCount: prev.retryCount + 1,
            validationErrors: errors
          }));
        } else {
          console.error('[validateAndResyncData] 최대 재시도 횟수 초과');
          setDataValidationState(prev => ({
            ...prev,
            validationErrors: errors
          }));
        }
      } else {
        console.log('[validateAndResyncData] 모든 데이터 검증 통과');
        setDataValidationState(prev => ({
          ...prev,
          retryCount: 0,
          validationErrors: []
        }));
      }
    } catch (error) {
      console.error('[validateAndResyncData] 검증 중 오류 발생:', error);
      setDataValidationState(prev => ({
        ...prev,
        validationErrors: [...prev.validationErrors, `검증 오류: ${error}`]
      }));
    } finally {
      setDataValidationState(prev => ({
        ...prev,
        isValidating: false,
        lastValidationTime: Date.now()
      }));
    }
  };

  // 일별 카운트 데이터 검증
  const validateDailyCountsData = async (groupId: number) => {
    try {
      const currentData = dailyCountsData;
      const freshData = await memberLocationLogService.getDailyLocationCounts(groupId, 14);

      if (!currentData || !freshData) {
        return { isValid: false, errors: ['일별 카운트 데이터가 없습니다.'] };
      }

      const errors: string[] = [];

      // 총 카운트 비교
      if (currentData.total_daily_counts.length !== freshData.total_daily_counts.length) {
        errors.push(`일별 카운트 개수 불일치: ${currentData.total_daily_counts.length} vs ${freshData.total_daily_counts.length}`);
      }

      // 각 날짜별 카운트 비교
      currentData.total_daily_counts.forEach((currentDay, index) => {
        const freshDay = freshData.total_daily_counts[index];
        if (freshDay && currentDay.count !== freshDay.count) {
          errors.push(`${currentDay.date} 카운트 불일치: ${currentDay.count} vs ${freshDay.count}`);
        }
      });

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: [`일별 카운트 검증 오류: ${error}`] };
    }
  };

  // 멤버별 활동 데이터 검증
  const validateMemberActivityData = async (groupId: number) => {
    try {
      const currentData = memberActivityData;
      const freshData = await memberLocationLogService.getMemberActivityByDate(groupId, selectedDate);

      if (!currentData || !freshData) {
        return { isValid: false, errors: ['멤버 활동 데이터가 없습니다.'] };
      }

      const errors: string[] = [];

      // 멤버 활동 개수 비교
      if (currentData.member_activities.length !== freshData.member_activities.length) {
        errors.push(`멤버 활동 개수 불일치: ${currentData.member_activities.length} vs ${freshData.member_activities.length}`);
      }

      // 각 멤버별 로그 수 비교
      currentData.member_activities.forEach(currentMember => {
        const freshMember = freshData.member_activities.find(m => m.member_id === currentMember.member_id);
        if (freshMember && currentMember.log_count !== freshMember.log_count) {
          errors.push(`${currentMember.member_name} 로그 수 불일치: ${currentMember.log_count} vs ${freshMember.log_count}`);
        }
      });

      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: [`멤버 활동 검증 오류: ${error}`] };
    }
  };

  // 그룹 멤버 데이터 검증
  const validateGroupMembersData = async (groupId: number) => {
    try {
      const currentMembers = groupMembers;
      const freshMemberCount = await getGroupMemberCount(groupId);

      if (currentMembers.length !== freshMemberCount) {
        return {
          isValid: false,
          errors: [`그룹 멤버 수 불일치: ${currentMembers.length} vs ${freshMemberCount}`]
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      return { isValid: false, errors: [`그룹 멤버 검증 오류: ${error}`] };
    }
  };

  // 모든 데이터 재세팅
  const resyncAllData = async (groupId: number) => {
    console.log('[resyncAllData] 모든 데이터 재세팅 시작:', groupId);

    try {
      // 캐시 무효화
      // if (!DISABLE_CACHE) {
      //   invalidateCache();
      // }

      // 1. 그룹 멤버 재로딩
      const freshMembers = await groupService.getGroupMembers(groupId);
      // GroupMember 타입에 맞게 변환
      const convertedMembers: GroupMember[] = freshMembers.map((member, index) => ({
        id: member.mt_idx.toString(),
        name: member.mt_name,
        photo: member.mt_file1 || null,
        isSelected: false,
        location: { lat: 0, lng: 0 },
        mt_gender: member.mt_gender,
        original_index: index,
        sgdt_owner_chk: member.sgdt_owner_chk,
        sgdt_leader_chk: member.sgdt_leader_chk,
        sgdt_idx: member.sgdt_idx
      }));
      setGroupMembers(convertedMembers);

      // 2. 일별 카운트 재로딩
      const freshDailyCounts = await memberLocationLogService.getDailyLocationCounts(groupId, 14);
      setDailyCountsData(freshDailyCounts);

      // 3. 멤버 활동 재로딩
      const freshMemberActivity = await memberLocationLogService.getMemberActivityByDate(groupId, selectedDate);
      setMemberActivityData(freshMemberActivity);

      console.log('[resyncAllData] 모든 데이터 재세팅 완료');
    } catch (error) {
      console.error('[resyncAllData] 데이터 재세팅 실패:', error);
      throw error;
    }
  };

  // 특정 날짜의 멤버 활동 조회 함수
  const loadMemberActivityByDate = async (groupId: number, date: string) => {
    if (isMemberActivityLoading) return;

    setIsMemberActivityLoading(true);
    console.log('[LOGS] 멤버 활동 조회 시작:', { groupId, date });

    try {
      const response = await memberLocationLogService.getMemberActivityByDate(groupId, date);
      setMemberActivityData(response);
      console.log('[LOGS] 멤버 활동 조회 완료:', response);
    } catch (error) {
      console.error('[LOGS] 멤버 활동 조회 실패:', error);
      handleDataError(error, 'loadMemberActivityByDate');
      setMemberActivityData(null);
    } finally {
      setIsMemberActivityLoading(false);
      // 멤버 활동 로딩 완료 햅틱 피드백
      hapticFeedback.dataLoadComplete();
    }
  };

  // locationSummary 상태 변경 모니터링
  useEffect(() => {
    console.log('[UI] locationSummary 상태 변경됨:', locationSummary);
  }, [locationSummary]);

  // 에러 상태 초기화 (성공적인 데이터 로딩 시)
  useEffect(() => {
    if (groupMembers.length > 0 || dailyCountsData || memberActivityData) {
      setDataError(null);
      setRetryCount(0);
    }
  }, [groupMembers, dailyCountsData, memberActivityData]);

  // 데이터 검증 자동 수행 (초기 로딩 완료 후)
  // 자동 데이터 검증 타이머 (비활성화 - 주기적 검증 불필요)
  // useEffect(() => {
  //   if (!selectedGroupId || isInitialLoading || dataValidationState.isValidating) {
  //     return;
  //   }

  //   // 자동 검증 비활성화 (주기적 검증 불필요)
  //   // const validationTimer = setTimeout(() => {
  //   //   if (!isInitialLoading && selectedGroupId) {
  //   //     console.log('[데이터 검증] 자동 검증 시작:', selectedGroupId);
  //   //     validateAndResyncData(selectedGroupId);
  //   //   }
  //   // }, 30000);

  //   // // 주기적 검증 (5분마다)
  //   // const periodicValidationTimer = setInterval(() => {
  //   //   if (!isInitialLoading && selectedGroupId && !dataValidationState.isValidating) {
  //   //     console.log('[데이터 검증] 주기적 검증 시작:', selectedGroupId);
  //   //     validateAndResyncData(selectedGroupId);
  //   //   }
  //   // }, 300000); // 5분

  //   // return () => {
  //   //   clearTimeout(validationTimer);
  //   //   clearInterval(periodicValidationTimer);
  //   // };
  // }, [selectedGroupId, isInitialLoading, dataValidationState.isValidating]);

  // 로딩 상태 안전장치 - 30초 후 강제 종료
  useEffect(() => {
    if (isLocationDataLoading) {
      // Vercel 환경에서는 더 짧은 안전장치 타이머 사용
      const isVercel = typeof window !== 'undefined' &&
        (window.location.hostname.includes('vercel.app') ||
          window.location.hostname.includes('nextstep.smap.site'));
      const safetyTimeout = isVercel ? 20000 : 30000; // Vercel: 20초, 기타: 30초

      const timeoutId = setTimeout(() => {
        console.warn(`[안전장치] 로딩이 ${safetyTimeout / 1000}초 이상 지속되어 강제 종료 (Vercel: ${isVercel})`);
        setIsLocationDataLoading(false);
        loadLocationDataExecutingRef.current.executing = false;
        loadLocationDataExecutingRef.current.currentRequest = undefined;
        loadLocationDataExecutingRef.current.cancelled = false;

        // 타임아웃 에러 표시
        setDataError({
          type: 'network',
          message: isVercel
            ? 'Vercel 환경에서 데이터 로딩 시간이 초과되었습니다. 다시 시도해주세요.'
            : '데이터 로딩 시간이 초과되었습니다. 다시 시도해주세요.',
          retryable: true
        });
      }, safetyTimeout);

      return () => clearTimeout(timeoutId);
    }
  }, [isLocationDataLoading]);

  // 새로운 API 데이터가 변경될 때마다 콘솔에 출력
  useEffect(() => {
    if (dailySummaryData.length > 0 || stayTimesData.length > 0 || mapMarkersData.length > 0 || locationLogSummaryData || dailyCountsData || memberActivityData) {
      logNewApiData();
    }
  }, [dailySummaryData, stayTimesData, mapMarkersData, locationLogSummaryData, dailyCountsData, memberActivityData]);

  // 날짜와 멤버를 함께 처리하는 통합 데이터 로딩 함수
  const loadDateMemberData = async (targetDate: string, targetMemberId?: string, triggerSource: 'date' | 'member' = 'date') => {
    console.log('[loadDateMemberData] ===== 통합 데이터 로딩 시작 =====');
    console.log('[loadDateMemberData] 입력값:', { targetDate, targetMemberId, triggerSource });

    if (!selectedGroupId) {
      console.warn('[loadDateMemberData] selectedGroupId가 없어서 중단');
      return;
    }

    try {
      // 1단계: 날짜 상태 업데이트 (날짜 변경인 경우에만)
      if (triggerSource === 'date' && targetDate !== selectedDate) {
        console.log('[loadDateMemberData] 날짜 상태 업데이트:', selectedDate, '->', targetDate);
        setPreviousDate(selectedDate);
        setSelectedDate(targetDate);

        // 사이드바 날짜 선택 영역을 새로운 날짜로 스크롤 (즉시 및 지연 실행)
        scrollSidebarDateToSelected(targetDate);
        setTimeout(() => {
          scrollSidebarDateToSelected(targetDate);
          console.log('[loadDateMemberData] 사이드바 날짜 스크롤 업데이트 완료:', targetDate);
        }, 100);
        setTimeout(() => {
          scrollSidebarDateToSelected(targetDate);
          console.log('[loadDateMemberData] 사이드바 날짜 스크롤 재확인 완료:', targetDate);
        }, 300);
      }

      // 2단계: 해당 날짜의 멤버 활동 데이터 조회
      console.log('[loadDateMemberData] 날짜별 멤버 활동 데이터 조회:', targetDate);
      const memberActivityResponse = await memberLocationLogService.getMemberActivityByDate(selectedGroupId, targetDate);

      if (!memberActivityResponse?.member_activities || memberActivityResponse.member_activities.length === 0) {
        console.warn('[loadDateMemberData] 해당 날짜에 활동한 멤버 없음:', targetDate);
        // 빈 데이터로 상태 업데이트
        setLocationSummary(DEFAULT_LOCATION_SUMMARY);
        setIsLocationDataLoading(false);
        setIsMapLoading(false);
        return;
      }

      // 3단계: 선택할 멤버 결정 (기존 멤버 정보 유지)
      const currentSelectedMember = groupMembers.find((m: GroupMember) => m.isSelected);
      let selectedMemberId = targetMemberId;

      // targetMemberId가 명시적으로 전달된 경우 해당 멤버 선택
      if (selectedMemberId) {
        console.log('[loadDateMemberData] 명시적으로 지정된 멤버 ID 사용:', selectedMemberId);
      } else if (currentSelectedMember) {
        // 현재 선택된 멤버가 있으면 유지 (활동 여부와 관계없이)
        selectedMemberId = currentSelectedMember.id;
        console.log('[loadDateMemberData] 현재 선택된 멤버 유지:', selectedMemberId, currentSelectedMember.name);
      } else {
        // 선택된 멤버가 없으면 첫 번째 활동 멤버 선택
        selectedMemberId = memberActivityResponse.member_activities[0].member_id.toString();
        console.log('[loadDateMemberData] 첫 번째 활동 멤버 선택:', selectedMemberId);
      }

      console.log('[loadDateMemberData] 최종 선택될 멤버 ID:', selectedMemberId);

      // 4단계: 기존 그룹 멤버 정보를 유지하면서 선택 상태만 업데이트
      const updatedMembers = groupMembers.map((member: GroupMember) => ({
        ...member,
        isSelected: member.id === selectedMemberId
      }));

      // 해당 날짜에 활동한 멤버 정보로 업데이트 (필요시)
      memberActivityResponse.member_activities.forEach((memberActivity: any) => {
        const memberIndex = updatedMembers.findIndex(m => m.id === memberActivity.member_id.toString());
        if (memberIndex !== -1) {
          // 기존 멤버 정보는 유지하고 활동 관련 정보만 업데이트
          updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            name: memberActivity.member_name || updatedMembers[memberIndex].name,
            photo: memberActivity.member_photo || updatedMembers[memberIndex].photo,
            mt_gender: typeof memberActivity.member_gender === 'number' ? memberActivity.member_gender : updatedMembers[memberIndex].mt_gender
          };
        }
      });

      // 상태 업데이트
      setGroupMembers(updatedMembers);

      // 5단계: 선택된 멤버의 위치 데이터 로딩
      const selectedMember = updatedMembers.find(m => m.isSelected);
      if (selectedMember) {
        // 선택된 멤버가 해당 날짜에 활동했는지 확인
        const memberIsActive = memberActivityResponse.member_activities.find(
          m => m.member_id.toString() === selectedMember.id
        );

        if (memberIsActive) {
          console.log('[loadDateMemberData] 선택된 멤버의 위치 데이터 로딩:', selectedMember.name, targetDate);

          // 로딩 상태 활성화
          setIsLocationDataLoading(true);
          setIsMapLoading(true);

          // 지도 초기화
          clearMapMarkersAndPaths(false, true, true);

          // 위치 데이터 로딩
          await loadLocationDataWithMapPreset(parseInt(selectedMember.id), targetDate, selectedMember, false);

          console.log('[loadDateMemberData] 위치 데이터 로딩 완료');
        } else {
          console.log('[loadDateMemberData] 선택된 멤버가 해당 날짜에 활동하지 않음:', selectedMember.name, targetDate);

          // 활동하지 않은 멤버의 경우 기본 위치로 지도 이동 및 멤버 마커만 표시
          setIsLocationDataLoading(false);
          setIsMapLoading(false);

          // 지도 초기화 (경로 및 활동 마커 제거)
          clearMapMarkersAndPaths(false, true, true);
          setLocationSummary(DEFAULT_LOCATION_SUMMARY);

          // 멤버의 기본 위치로 지도 중심 이동
          if (map.current) {
            const memberLat = selectedMember.mlt_lat || selectedMember.location.lat || 37.5665;
            const memberLng = selectedMember.mlt_long || selectedMember.location.lng || 126.9780;
            const LatLng7 = (window as any)?.naver?.maps?.LatLng; if (!LatLng7) return;
            const adjustedPosition = new LatLng7(memberLat, memberLng);

            map.current.setCenter(adjustedPosition);
            map.current.setZoom(16);

            // 멤버 마커만 표시
            setTimeout(() => {
              updateMemberMarkers(updatedMembers, false);
              console.log('[loadDateMemberData] 활동하지 않은 멤버 - 기본 위치로 지도 설정 완료');
            }, 100);
          }
        }
      }

      console.log('[loadDateMemberData] ===== 통합 데이터 로딩 완료 =====');

      // 🎯 데이터 로딩 완료 후 슬라이더를 시작점으로 리셋
      setTimeout(() => {
        setSliderValue(0);
        setIsSliderDragging(false);
        console.log('[loadDateMemberData] 슬라이더를 시작점(0%)으로 리셋 완료');
      }, 200);

    } catch (error) {
      console.error('[loadDateMemberData] 오류:', error);
      setIsLocationDataLoading(false);
      setIsMapLoading(false);
      handleDataError(error, 'loadDateMemberData');
    }
  };

  // 날짜 변경 중 자동 재생성 방지 플래그
  const isDateChangingRef = useRef(false);

  // 지도 마커 데이터가 변경될 때마다 지도에 마커 업데이트 (날짜 변경 중에는 방지)
  useEffect(() => {
    console.log('[LOGS] 마커 데이터 변경 감지:', {
      isMapInitializedActivelog,
      mapMarkersDataLength: mapMarkersData.length,
      mapMarkersData: mapMarkersData.slice(0, 2), // 첫 2개만 로그
      isDateChanging: isDateChangingRef.current,
      firstMemberSelected
    });

    // 초기 진입 시에는 마커 업데이트 허용 (firstMemberSelected가 false일 때)
    if (isDateChangingRef.current && firstMemberSelected) {
      console.log('[LOGS] 날짜 변경 중 - 자동 마커 업데이트 완전 차단! (초기 진입은 제외)');
      return;
    }

    // 마커 데이터가 있을 때만 지도 업데이트 수행 (빈 배열일 때는 건너뜀)
    if (isMapInitializedActivelog && mapMarkersData.length > 0) {
      console.log('[LOGS] 지도에 마커 업데이트 실행:', mapMarkersData.length, '개');

      // 첫 번째 마커(시작지점)를 기준으로 지도 중심 조정
      if (map.current && mapMarkersData.length > 0) {
        const firstMarker = mapMarkersData[0];
        const lat = firstMarker.latitude || firstMarker.mlt_lat || 0;
        const lng = firstMarker.longitude || firstMarker.mlt_long || 0;

        if (lat !== 0 && lng !== 0) {
          const LatLngCtor = (window as any)?.naver?.maps?.LatLng;
          if (!LatLngCtor) {
            console.warn('[LOGS] naver.maps.LatLng 사용 불가 - SDK 로드 안됨 또는 초기화 해제됨');
            return;
          }
          const adjustedPosition = new LatLngCtor(lat, lng);

          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16); // 줌 레벨 16으로 설정
          map.current.refresh(true);

          // 시작지점 기준 지도 조정 완료 후 firstMemberSelected를 true로 설정하여 추가 조정 방지
          setFirstMemberSelected(true);

          // 날짜 변경 플래그 리셋 (시작지점 기준 조정 완료 후)
          if (isDateChangedRef.current) {
            isDateChangedRef.current = false;
            console.log('[LOGS] 시작지점 기준 지도 조정 완료 후 날짜 변경 플래그 리셋');
          }

          console.log('[LOGS] 시작지점 기준 지도 조정:', { lat, lng, adjustedPosition });
        }
      } else if (map.current && mapMarkersData.length === 0) {
        // 데이터가 없을 때도 멤버 아이콘은 표시되도록 처리 (지도 중심 먼저 설정)
        console.log('[LOGS] 마커 데이터 없음 - 지도 중앙 이동 후 멤버 마커 업데이트');
        const selectedMember = groupMembers.find(m => m.isSelected);
        if (selectedMember) {
          const memberLat = selectedMember.mlt_lat || selectedMember.location.lat || 37.5665;
          const memberLng = selectedMember.mlt_long || selectedMember.location.lng || 126.9780;
          const LatLngCtor = (window as any)?.naver?.maps?.LatLng;
          if (!LatLngCtor) {
            console.warn('[LOGS] naver.maps.LatLng 사용 불가 - SDK 로드 안됨 또는 초기화 해제됨');
            return;
          }
          const adjustedPosition = new LatLngCtor(memberLat, memberLng);

          // 지도 중심 먼저 설정
          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16);

          // 지연 후 멤버 마커 생성
          setTimeout(() => {
            updateMemberMarkers(groupMembers, false);
            console.log('[LOGS] 지도 중앙 이동 후 멤버 아이콘 업데이트 완료');
          }, 50);
        }
      }
    } else {
      console.log('[LOGS] 지도가 초기화되지 않아서 마커 업데이트 건너뜀');
    }
  }, [mapMarkersData, isMapInitializedActivelog, groupMembers]); // groupMembers 종속성 추가

  // 체류시간 데이터가 변경될 때마다 지도에 체류시간 마커 업데이트
  // (updateLocationLogMarkers 내에서 호출되므로 중복 실행 방지를 위해 주석 처리)
  // useEffect(() => {
  //   if (isMapInitializedActivelog && stayTimesData.length > 0) {
  //     console.log('[LOGS] 체류시간 데이터 변경 감지 - 지도에 체류시간 마커 업데이트:', stayTimesData.length, '개');
  //     updateStayTimeMarkers(stayTimesData);
  //   }
  // }, [stayTimesData, isMapInitializedActivelog]);

  // 그룹 멤버가 변경될 때마다 멤버 마커 업데이트
  useEffect(() => {
    if (isMapInitializedActivelog && groupMembers.length > 0) {
      console.log('[LOGS] 그룹 멤버 변경 감지 - 멤버 마커 업데이트:', groupMembers.length, '명');
      // 초기 진입 시에는 멤버 마커 업데이트 허용, 날짜 변경 중이고 초기화 완료된 경우에만 방지
      if (!isDateChangingRef.current || !firstMemberSelected) {
        // 로그 데이터가 없고 선택된 멤버가 있으면 지도 중심 먼저 설정
        const selectedMember = groupMembers.find(m => m.isSelected);
        if (selectedMember && sortedLocationData.length === 0 && map.current) {
          const memberLat = selectedMember.mlt_lat || selectedMember.location.lat || 37.5665;
          const memberLng = selectedMember.mlt_long || selectedMember.location.lng || 126.9780;
          const LatLng8 = (window as any)?.naver?.maps?.LatLng; if (!LatLng8) return;
          const adjustedPosition = new LatLng8(memberLat, memberLng);

          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16);

          setTimeout(() => {
            updateMemberMarkers(groupMembers, false);
          }, 50);
        } else {
          updateMemberMarkers(groupMembers, false);
        }
      } else {
        console.log('[LOGS] 날짜 변경 중으로 멤버 마커 업데이트 건너뜀 (초기화 완료 상태)');
      }
    }
  }, [groupMembers, isMapInitializedActivelog, sortedLocationData, firstMemberSelected]);

  // 슬라이더 드래그를 위한 전역 이벤트 리스너
  useEffect(() => {
    if (!isSliderDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateSliderValue(e);
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsSliderDragging(false);
      console.log('[슬라이더] 전역 마우스 드래그 종료');
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateSliderValue(e);
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsSliderDragging(false);
      console.log('[슬라이더] 전역 터치 드래그 종료');
    };

    // 마우스 및 터치 이벤트 모두 처리
    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isSliderDragging]);

  // useEffect for auto-selecting the first member and updating map based on selection
  useEffect(() => {
    console.log("[LogsPage] 🔥 초기 진입 useEffect 실행됨:", {
      isMapInitializedActivelog,
      groupMembersLength: groupMembers.length,
      hasSelectedMember: groupMembers.some(m => m.isSelected),
      selectedDate,
      firstMemberSelected,
      hasExecuted: hasExecuted.current,
      isMainInstance: isMainInstance.current
    });

    // 메인 인스턴스에서만 실행
    if (!isMainInstance.current) {
      console.log("[LogsPage] 서브 인스턴스 - 건너뜀");
      return;
    }

    // 모든 조건이 준비되었는지 확인
    if (!isMapInitializedActivelog || groupMembers.length === 0 || !selectedDate) {
      console.log("[LogsPage] 초기화 조건 미충족:", {
        isMapInitializedActivelog,
        groupMembersLength: groupMembers.length,
        selectedDate
      });
      return;
    }

    // 이미 첫 번째 멤버가 선택되고 데이터 로딩이 완료된 경우 건너뛰기
    if (firstMemberSelected && groupMembers.some(m => m.isSelected) && !isDateChangedRef.current) {
      console.log("[LogsPage] 이미 초기화 완료됨 - 건너뜀");
      return;
    }

    // 첫 번째 멤버 자동 선택 및 데이터 로딩 통합 처리
    const initializeFirstMember = async () => {
      try {
        console.log("[LogsPage] 🚀 첫 번째 멤버 초기화 시작");

        // 모든 플래그 초기화
        isDateChangingRef.current = false;
        isDateChangedRef.current = false;
        loadLocationDataExecutingRef.current = { executing: false, cancelled: false };

        // 첫 번째 멤버 선택
        let updatedMembers = groupMembers;
        if (!groupMembers.some(m => m.isSelected)) {
          updatedMembers = groupMembers.map((member, index) => ({
            ...member,
            isSelected: index === 0
          }));

          console.log("[LogsPage] 첫 번째 멤버 자동 선택:", updatedMembers[0].name);
          setGroupMembers(updatedMembers);

          // 지도 중심 설정
          const firstMember = updatedMembers[0];
          if (map.current && firstMember) {
            const LatLng = (window as any)?.naver?.maps?.LatLng; if (!LatLng) return;
            const adjustedPosition = new LatLng(
              firstMember.location.lat,
              firstMember.location.lng
            );
            map.current.setCenter(adjustedPosition);
            map.current.setZoom(16);
            console.log("[LogsPage] 지도 중심 설정 완료");
          }

          // 멤버 마커 생성
          updateMemberMarkers(updatedMembers, false);
        }

        // 🚀 모든 멤버의 오늘 데이터 프리로드 (백그라운드)
        const preloadAllMembersData = async () => {
          console.log("[LogsPage] 🔄 모든 멤버 오늘 데이터 프리로드 시작");

          const today = getTodayDateString();
          const preloadPromises = updatedMembers.map(async (member, index) => {
            try {
              // 선택된 멤버는 우선순위로 먼저 로드
              if (member.isSelected) {
                console.log(`[LogsPage] 🎯 우선순위 로딩: ${member.name} (${today})`);
                await loadLocationDataWithMapPreset(parseInt(member.id), today, member, false);
                return { success: true, member: member.name, priority: true };
              } else {
                // 다른 멤버들은 백그라운드에서 데이터만 로딩 (지도 렌더링 없이)
                await new Promise(resolve => setTimeout(resolve, index * 500));
                console.log(`[LogsPage] 🔄 백그라운드 로딩: ${member.name} (${today}) - 데이터만`);
                // 지도에 렌더링하지 않고 데이터만 캐시에 저장
                try {
                  const mapMarkers = await memberLocationLogService.getMapMarkers(parseInt(member.id), today);
                  const stayTimes = await memberLocationLogService.getStayTimes(parseInt(member.id), today);
                  console.log(`[LogsPage] 📦 ${member.name} 데이터 캐시 완료: 마커 ${mapMarkers.length}개, 체류 ${stayTimes.length}개`);
                } catch (error) {
                  console.warn(`[LogsPage] ⚠️ ${member.name} 백그라운드 로딩 실패:`, error);
                }
                return { success: true, member: member.name, priority: false };
              }
            } catch (error) {
              console.warn(`[LogsPage] ⚠️ ${member.name} 데이터 로딩 실패:`, error);
              return { success: false, member: member.name, error };
            }
          });

          // 모든 프리로드 완료 대기
          const results = await Promise.allSettled(preloadPromises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

          console.log(`[LogsPage] ✅ 프리로드 완료: ${successCount}/${updatedMembers.length}명`);

          // 선택된 멤버의 마커가 완전히 로딩된 후에 플래그 설정
          setTimeout(() => {
            setIsLocationDataLoading(false);
            setFirstMemberSelected(true);
            isDateChangedRef.current = false;
            console.log('[LogsPage] 🎯 초기 진입 완료 - firstMemberSelected 설정');
          }, 500);
        };

        // 선택된 멤버가 있고 초기화가 필요한 경우에만 프리로드 실행
        const selectedMember = updatedMembers.find(m => m.isSelected);
        if (selectedMember && (!firstMemberSelected || isDateChangedRef.current)) {
          console.log("[LogsPage] 🚀 데이터 프리로드 시작:", selectedMember.name, selectedDate);
          setIsLocationDataLoading(true);
          preloadAllMembersData();
        }

        console.log("[LogsPage] ✅ 첫 번째 멤버 초기화 완료");

      } catch (error) {
        console.error("[LogsPage] ❌ 첫 번째 멤버 초기화 실패:", error);
        setIsLocationDataLoading(false);
        handleDataError(error, '초기화');
      }
    };

    // 비동기 초기화 실행
    initializeFirstMember();

  }, [isMapInitializedActivelog, groupMembers.length, selectedDate, firstMemberSelected, groupMembers, selectedGroupId, isUserDataLoading, userGroups.length]);

  // 백업 useEffect 제거됨 - 위의 통합 로직에서 처리



  // 날짜 스크롤 자동 조정 함수
  const scrollToTodayDate = (reason?: string) => {
    if (dateScrollContainerRef.current) {
      const container = dateScrollContainerRef.current;
      // 즉시 스크롤을 맨 오른쪽으로 이동 (오늘 날짜 보이게)
      container.scrollLeft = container.scrollWidth;
      console.log('[날짜 스크롤] 오늘 날짜로 이동 완료', reason ? `(${reason})` : '');
    }
  };

  // 특정 날짜로 스크롤하는 함수 (사이드바 Motion 기반)
  const scrollToSelectedDate = (targetDate: string, reason?: string) => {
    // 사이드바가 열려있고 Motion 날짜 선택기가 있는 경우
    if (isSidebarOpen && sidebarDateX) {
      const recentDays = getRecentDays();
      const targetIndex = recentDays.findIndex(day => day.value === targetDate);
      const currentIndex = recentDays.findIndex(day => day.value === selectedDate);

      if (targetIndex !== -1) {
        // 🎯 항상 정확한 위치로 스크롤 (스크롤 생략 로직 제거)
        console.log('[날짜 스크롤] 선택된 날짜로 스크롤 시작:', {
          targetDate,
          currentDate: selectedDate,
          targetIndex,
          currentIndex,
          reason
        });

        {
          // 각 버튼의 너비 + gap을 고려하여 위치 계산
          const buttonWidth = 85; // min-w-[80px] + gap
          const containerWidth = 200; // 사이드바 날짜 컨테이너 너비
          const totalWidth = recentDays.length * buttonWidth;
          const targetPosition = buttonWidth * targetIndex;

          // 중앙 정렬을 위한 오프셋 계산
          const centerOffset = containerWidth / 2 - buttonWidth / 2;
          let finalPosition = -(targetPosition - centerOffset);

          // 경계 값 체크
          const maxScroll = Math.max(0, totalWidth - containerWidth);
          finalPosition = Math.max(-maxScroll, Math.min(0, finalPosition));

          // Motion Value로 부드러운 이동
          sidebarDateX.set(finalPosition);

          // 스크롤 실행 시 마지막 스크롤 위치 업데이트
          lastScrolledIndexRef.current = targetIndex;

          console.log('[날짜 스크롤] 사이드바 날짜로 이동 완료:', targetDate, reason ? `(${reason})` : '', {
            targetIndex,
            currentIndex,
            finalPosition,
            distance: Math.abs(targetIndex - currentIndex)
          });
        }

        // 선택된 날짜 버튼에 고급스러운 시각적 강조 효과 추가 (항상 실행)
        const effectDelay = 100; // 즉시 강조
        setTimeout(() => {
          if (dateScrollContainerRef.current) {
            const buttons = dateScrollContainerRef.current.querySelectorAll('button');
            const targetButton = buttons[targetIndex];
            if (targetButton) {
              targetButton.style.transform = 'scale(1.08) translateY(-2px)';
              targetButton.style.boxShadow = '0 12px 35px -8px rgba(1, 19, 163, 0.35), 0 0 0 3px rgba(1, 19, 163, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
              targetButton.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              targetButton.style.filter = 'brightness(1.1) saturate(1.2)';

              setTimeout(() => {
                targetButton.style.transform = '';
                targetButton.style.boxShadow = '';
                targetButton.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                targetButton.style.filter = '';

                // 트랜지션 완료 후 초기화
                setTimeout(() => {
                  targetButton.style.transition = '';
                }, 400);
              }, 600);
            }
          }
        }, effectDelay);

      } else {
        console.log('[날짜 스크롤] 날짜를 찾을 수 없음:', targetDate);
      }
    } else {
      console.log('[날짜 스크롤] 사이드바가 닫혀있거나 Motion 객체가 없음');
    }
  };

  // 날짜 버튼 초기 스크롤 위치 설정 (초기 로드 시에만)
  const [isInitialScrollDone, setIsInitialScrollDone] = useState(false);
  const scrollExecutedRef = useRef(false);

  useEffect(() => {
    if (!isInitialScrollDone && showDateSelection && !scrollExecutedRef.current) {
      scrollExecutedRef.current = true;
      // DOM이 완전히 렌더링된 후 실행
      const scheduleScroll = () => {
        requestAnimationFrame(() => {
          scrollToTodayDate('초기 로드');
          setIsInitialScrollDone(true);
        });
      };

      // 첫 로드 시에만 스크롤 실행
      setTimeout(scheduleScroll, 300);
    }
  }, [showDateSelection, isInitialScrollDone]);

  // 그룹이 변경될 때만 오늘 날짜로 스크롤
  useEffect(() => {
    if (selectedGroupId && isInitialScrollDone) {
      setTimeout(() => scrollToTodayDate('그룹 변경'), 200);
    }
  }, [selectedGroupId]);

  // UserContext 데이터가 로딩 완료되면 첫 번째 그룹을 자동 선택 - 메인 인스턴스에서만
  useEffect(() => {
    if (!isMainInstance.current) return;

    if (!isUserDataLoading && userGroups.length > 0 && !selectedGroupId) {
      // 약간의 지연을 주어 UserContext 상태가 완전히 안정화된 후 그룹 선택
      setTimeout(() => {
        setSelectedGroupId(userGroups[0].sgt_idx);
        console.log(`[${instanceId.current}] UserContext에서 첫 번째 그룹 자동 선택:`, userGroups[0].sgt_title);
      }, 100);
    }
  }, [isUserDataLoading, userGroups, selectedGroupId]);

  // 그룹 멤버 및 스케줄 데이터 가져오기 - 메인 인스턴스에서만 실행
  const fetchDataExecutingRef = useRef(false);
  useEffect(() => {
    // 메인 인스턴스가 아니면 실행하지 않음
    if (!isMainInstance.current) {
      console.log(`[${instanceId.current}] 서브 인스턴스 - fetchAllGroupData 건너뜀`);
      return;
    }

    // 이미 실행되었으면 건너뜀
    if (hasExecuted.current) {
      console.log(`[${instanceId.current}] 이미 실행됨 - fetchAllGroupData 건너뜀`);
      return;
    }

    let isMounted = true;

    const fetchAllGroupData = async () => {
      if (!isMounted || !isMainInstance.current) return;

      // selectedGroupId가 없으면 실행하지 않음
      if (!selectedGroupId) {
        console.log(`[${instanceId.current}] selectedGroupId가 없어서 실행하지 않음`);
        return;
      }

      // UserContext 로딩이 완료되었는지 추가 확인
      if (isUserDataLoading || userGroups.length === 0) {
        console.log(`[${instanceId.current}] UserContext 아직 로딩 중 - 실행 대기`);
        return;
      }

      // 중복 실행 방지
      if (dataFetchedRef.current.members || fetchDataExecutingRef.current || hasExecuted.current) {
        console.log(`[${instanceId.current}] 중복 실행 방지 - 이미 로드됨 또는 실행 중`);
        return;
      }

      hasExecuted.current = true;
      fetchDataExecutingRef.current = true;
      const fetchId = Math.random().toString(36).substr(2, 9);
      console.log(`[${instanceId.current}-fetchAllGroupData-${fetchId}] 데이터 페칭 시작:`, selectedGroupId);

      // 로딩 단계 업데이트 - 멤버 데이터 조회 시작
      updateLoadingStepSafe('members');
      updateLoadingProgressSafe(60);

      try {
        const groupIdToUse = selectedGroupId.toString();
        console.log('[fetchAllGroupData] 사용할 그룹 ID:', groupIdToUse);

        let currentMembers: GroupMember[] = groupMembers.length > 0 ? [...groupMembers] : [];

        if (!dataFetchedRef.current.members) {
          // 캐시에서 먼저 확인 - LOGS 페이지에서는 캐시 비활성화
          const cachedMembers = !DISABLE_CACHE ? getCachedGroupMembers(selectedGroupId) : null;
          const isCacheValid_Members = !DISABLE_CACHE ? isCacheValid('groupMembers', selectedGroupId) : false;

          if (cachedMembers && cachedMembers.length > 0 && isCacheValid_Members && !DISABLE_CACHE) {
            console.log('[LOGS] 캐시에서 그룹 멤버 데이터 사용:', cachedMembers.length, '명');

            // 캐시된 데이터를 UI 형식으로 변환
            currentMembers = cachedMembers.map((member: any, index: number) => {
              const lat = member.mlt_lat !== null && member.mlt_lat !== undefined && member.mlt_lat !== 0
                ? parseFloat(member.mlt_lat.toString())
                : parseFloat(member.mt_lat || '37.5665');
              const lng = member.mlt_long !== null && member.mlt_long !== undefined && member.mlt_long !== 0
                ? parseFloat(member.mlt_long.toString())
                : parseFloat(member.mt_long || '126.9780');

              return {
                id: member.mt_idx.toString(),
                name: member.mt_name || `멤버 ${index + 1}`,
                photo: member.mt_file1,
                isSelected: index === 0,
                location: { lat, lng },
                schedules: [],
                mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
                original_index: index,
                mt_weather_sky: member.mt_weather_sky,
                mt_weather_tmx: member.mt_weather_tmx,
                mt_weather_tmn: member.mt_weather_tmn,
                mt_weather_date: member.mt_weather_date,
                mlt_lat: member.mlt_lat,
                mlt_long: member.mlt_long,
                mlt_speed: member.mlt_speed,
                mlt_battery: member.mlt_battery,
                mlt_gps_time: member.mlt_gps_time,
                sgdt_owner_chk: member.sgdt_owner_chk,
                sgdt_leader_chk: member.sgdt_leader_chk,
                sgdt_idx: member.sgdt_idx
              };
            });

            setGroupMembers(currentMembers);
          } else {
            // 캐시에 없거나 만료된 경우 API 호출
            console.log('[LOGS] 캐시 미스 - API에서 그룹 멤버 데이터 조회');

            try {
              // 재시도 로직 적용
              const memberData = await retryDataFetch(
                () => memberService.getGroupMembers(groupIdToUse),
                'LOGS_GROUP_MEMBERS'
              );

              if (memberData && memberData.length > 0) {
                if (isMounted) setGroupMembers(currentMembers);
                // 캐시에 저장 (타입 변환)
                const cacheMembers = memberData.map((member: any) => ({
                  ...member,
                  sgdt_owner_chk: member.sgdt_owner_chk || '',
                  sgdt_leader_chk: member.sgdt_leader_chk || ''
                }));
                if (!DISABLE_CACHE) {
                  setCachedGroupMembers(selectedGroupId, cacheMembers);
                } else {
                  console.log('[LOGS] 📋 LOGS 페이지 - 그룹 멤버 캐시 저장 건너뛰기');
                }

                currentMembers = memberData.map((member: any, index: number) => {
                  // 위치 데이터 우선순위: mlt_lat/mlt_long (최신 GPS) > mt_lat/mt_long (기본 위치)
                  const lat = member.mlt_lat !== null && member.mlt_lat !== undefined && member.mlt_lat !== 0
                    ? parseFloat(member.mlt_lat.toString())
                    : parseFloat(member.mt_lat || '37.5665'); // 서울시청 기본 좌표
                  const lng = member.mlt_long !== null && member.mlt_long !== undefined && member.mlt_long !== 0
                    ? parseFloat(member.mlt_long.toString())
                    : parseFloat(member.mt_long || '126.9780');

                  console.log(`[LOGS] 멤버 ${member.mt_name} 위치 설정:`, {
                    mlt_lat: member.mlt_lat,
                    mlt_long: member.mlt_long,
                    mt_lat: member.mt_lat,
                    mt_long: member.mt_long,
                    final_lat: lat,
                    final_lng: lng
                  });

                  return {
                    id: member.mt_idx.toString(),
                    name: member.mt_name || `멤버 ${index + 1}`,
                    photo: member.mt_file1,
                    mt_file1: member.mt_file1,
                    isSelected: index === 0, // 첫 번째 멤버만 자동 선택
                    location: { lat, lng },
                    schedules: [],
                    mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
                    original_index: index,
                    mt_weather_sky: member.mt_weather_sky,
                    mt_weather_tmx: member.mt_weather_tmx,
                    mt_weather_tmn: member.mt_weather_tmn,
                    mt_weather_date: member.mt_weather_date,
                    mlt_lat: member.mlt_lat,
                    mlt_long: member.mlt_long,
                    mlt_speed: member.mlt_speed,
                    mlt_battery: member.mlt_battery,
                    mlt_gps_time: member.mlt_gps_time,
                    sgdt_owner_chk: member.sgdt_owner_chk,
                    sgdt_leader_chk: member.sgdt_leader_chk,
                    sgdt_idx: member.sgdt_idx
                  };
                });

                console.log('[🔥 LOGS] setGroupMembers 호출:', {
                  currentMembersLength: currentMembers.length,
                  firstMember: currentMembers[0],
                  hasValidLocation: currentMembers[0]?.location?.lat && currentMembers[0]?.location?.lng
                });
                setGroupMembers(currentMembers);

                // 로딩 단계 업데이트 - 멤버 데이터 로딩 완료
                updateLoadingStepSafe('data');
                updateLoadingProgressSafe(85);

                // 첫 번째 멤버의 데이터 기반 통합 지도 설정 - 자동 날짜 선택 후 처리됨
                if (currentMembers.length > 0 && map.current) {
                  const firstMember = currentMembers[0];
                  console.log('[LOGS] 첫 번째 멤버로 통합 지도 설정 시작:', firstMember.name);
                  // 자동 날짜 선택 로직이 데이터가 있는 날짜를 찾아서 위치 데이터를 로딩할 예정
                }
              } else {
                console.warn('❌ No member data from API, or API call failed.');
                if (isMounted) setGroupMembers([]);

                console.log('[LOGS] 멤버 데이터 없음 - 초기 로딩 실패 처리');
                setHasInitialLoadFailed(true);
                updateLoadingStepSafe('members');
                handleDataError(new Error('그룹 멤버 데이터가 없습니다.'), 'fetchAllGroupData');
              }
            } catch (memberError) {
              console.error('[LOGS] 그룹 멤버 조회 API 오류:', memberError);
              setHasInitialLoadFailed(true);
              updateLoadingStepSafe('members');
              handleDataError(memberError, 'fetchAllGroupData');
              setGroupMembers([]);
            }
            dataFetchedRef.current.members = true;

            // 그룹 멤버 조회 완료 - 추가 API 호출은 지연 로딩으로 최적화
            console.log('[LOGS] 그룹 멤버 조회 완료 - 기본 데이터 로딩 완료 (추가 API는 지연 로딩)');

            // 지연 로딩 최적화: 초기 진입 시 필수가 아닌 API들은 나중에 호출
            if (isMounted) {
              // 캐시에서 일별 카운트 데이터 즉시 복원 (사이드바 표시용) - LOGS 페이지에서는 캐시 비활성화
              if (!DISABLE_CACHE) {
                const cachedCounts = getCachedDailyLocationCounts(selectedGroupId);
                const isCountsCacheValid = isCacheValid('dailyLocationCounts', selectedGroupId);

                if (cachedCounts && isCountsCacheValid) {
                  console.log('[LOGS] 캐시에서 일별 카운트 데이터 즉시 복원');
                  setDailyCountsData(cachedCounts);
                  dataFetchedRef.current.dailyCounts = true;
                }
              } else {
                console.log('[LOGS] 📋 LOGS 페이지 - 일별 카운트 캐시 조회 건너뛰기');
              }

              // 🚨 iOS 시뮬레이터 최적화: 즉시 로딩으로 변경 (지연 시간 제거)
              if (isMounted) {
                console.log('🚀 [LOGS] iOS 시뮬레이터 최적화 - 사이드바 캘린더 데이터 즉시 로딩');
                const immediatePromises = [];

                // 1. 최근 14일간 일별 카운트 조회 (사이드바 캘린더용) - LOGS 페이지에서는 캐시 비활성화로 항상 로딩
                if (DISABLE_CACHE || !dailyCountsData || !dataFetchedRef.current.dailyCounts) {
                  console.log('🚀 [LOGS] API에서 일별 카운트 데이터 조회 (캐시 비활성화 또는 데이터 없음)');
                  immediatePromises.push(loadDailyLocationCounts(selectedGroupId, 14));
                  dataFetchedRef.current.dailyCounts = true;
                } else {
                  console.log('✅ [LOGS] 일별 카운트 데이터 이미 로드됨 - 즉시 로딩 건너뛰기');
                }

                // 2. 현재 선택된 날짜의 멤버 활동 조회 - 즉시 로딩
                if (selectedDate) {
                  console.log('🚀 [LOGS] 현재 날짜 멤버 활동 데이터 즉시 로딩');
                  immediatePromises.push(loadMemberActivityByDate(selectedGroupId, selectedDate));
                }

                // 즉시 로딩 병렬 실행
                if (immediatePromises.length > 0) {
                  (async () => {
                    try {
                      await Promise.all(immediatePromises);
                      console.log('✅ [LOGS] 즉시 로딩 완료');
                    } catch (promiseError) {
                      console.error('❌ [LOGS] 즉시 로딩 중 일부 실패:', promiseError);
                      // 일부 실패해도 계속 진행
                    }
                  })();
                }
              }
            }


          }
        }


      } catch (error) {
        console.error('[LOGS PAGE] 그룹 데이터(멤버 또는 스케줄) 조회 오류:', error);
        handleDataError(error, 'fetchAllGroupData');

        if (isMounted && !dataFetchedRef.current.members) {
          dataFetchedRef.current.members = true;
        }
      } finally {
        fetchDataExecutingRef.current = false;
        console.log(`[${instanceId.current}-fetchAllGroupData-${fetchId}] 데이터 페칭 완료`);
      }
    };

    fetchAllGroupData();

    return () => {
      isMounted = false;
      fetchDataExecutingRef.current = false;
    };
  }, [selectedGroupId, isUserDataLoading, userGroups]);

  // 초기 로딩 실패 시 자동 재시도 로직
  useEffect(() => {
    if (!isMainInstance.current) return;

    // 조건: selectedGroupId는 있지만 groupMembers가 없고, UserContext 로딩이 완료된 상태
    if (selectedGroupId &&
      groupMembers.length === 0 &&
      !isUserDataLoading &&
      userGroups.length > 0 &&
      !fetchDataExecutingRef.current &&
      !hasExecuted.current) {

      console.log(`[${instanceId.current}] 초기 로딩 실패 감지 - 자동 재시도 시작`);

      // Vercel 환경에서는 더 짧은 재시도 간격 사용
      const isVercel = typeof window !== 'undefined' &&
        (window.location.hostname.includes('vercel.app') ||
          window.location.hostname.includes('nextstep.smap.site'));
      const retryDelay = isVercel ? 500 : 1000; // Vercel: 0.5초, 기타: 1초

      const retryTimer = setTimeout(() => {
        if (groupMembers.length === 0 && selectedGroupId) {
          console.log(`[${instanceId.current}] ${retryDelay}ms 후 자동 재시도 실행 (Vercel: ${isVercel})`);
          hasExecuted.current = false; // 재시도를 위해 플래그 리셋
          dataFetchedRef.current.members = false;
          fetchDataExecutingRef.current = false;
        }
      }, retryDelay);

      return () => clearTimeout(retryTimer);
    }
  }, [selectedGroupId, groupMembers.length, isUserDataLoading, userGroups.length]);

  // 그룹 선택 핸들러 - 메인 인스턴스에서만
  const handleGroupSelect = useCallback(async (groupId: number) => {
    if (!isMainInstance.current) {
      console.log(`[${instanceId.current}] 서브 인스턴스 - 그룹 선택 건너뜀`);
      return;
    }

    console.log(`[${instanceId.current}] 그룹 선택:`, groupId);

    // 그룹 변경 시 즉시 지도 초기화 (멤버 마커도 제거)
    clearMapMarkersAndPaths(true);
    console.log(`[${instanceId.current}] 그룹 변경으로 지도 초기화 완료`);

    // 이전 그룹 캐시 무효화 (선택적)
    if (selectedGroupId) {
      invalidateCache('groupMembers', selectedGroupId);
      invalidateCache('locationData', selectedGroupId);
      invalidateCache('dailyLocationCounts', selectedGroupId);
      console.log(`[${instanceId.current}] 이전 그룹(${selectedGroupId}) 캐시 무효화 완료`);
    }

    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);

    // 기존 데이터 초기화
    setGroupMembers([]);
    setFirstMemberSelected(false);
    dataFetchedRef.current = { members: false, dailyCounts: false };
    fetchDataExecutingRef.current = false;
    hasExecuted.current = false; // 실행 플래그도 리셋
    loadLocationDataExecutingRef.current.executing = false; // loadLocationData 실행 플래그도 리셋
    // 첫 멤버 선택 실행 플래그는 통합 useEffect에서 처리하므로 제거

    // 날짜별 활동 로그 데이터 초기화
    setDailyCountsData(null);
    setMemberActivityData(null);

    console.log(`[${instanceId.current}] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작`);
  }, [setSelectedGroupId, setGroupMembers, setSelectedDate, setDailyCountsData, setMemberActivityData]);

  // 그룹별 멤버 수 조회 - 캐시 시스템 적용 (페이지 로드 시 즉시 실행)
  const groupMemberCountsLoadingRef = useRef<boolean>(false);
  const groupMemberCountsCacheRef = useRef<Record<number, { count: number; timestamp: number }>>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

  // 초기 데이터 로딩 완료 - 즉시 설정
  useEffect(() => {
    setIsInitialDataLoaded(true);
  }, []);

  // 즉시 그룹 멤버 수 로드 (가장 먼저 실행)
  useEffect(() => {
    console.log(`[${instanceId.current}] 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 즉시 로드 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        updateGroupMemberCountsWithState({});
        return;
      }

      console.log(`[${instanceId.current}] 즉시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      updateGroupMemberCountsWithState(counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 즉시 실행

  // 추가: 컴포넌트 마운트 즉시 그룹 멤버 수 로드 (가장 우선순위)
  useEffect(() => {
    console.log(`[${instanceId.current}] 컴포넌트 마운트 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        setGroupMemberCounts({});
        return;
      }

      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회 완료:`, counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // 추가: 컴포넌트 마운트 즉시 그룹 멤버 수 로드 (가장 우선순위)
  useEffect(() => {
    console.log(`[${instanceId.current}] 컴포넌트 마운트 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        setGroupMemberCounts({});
        return;
      }

      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회 완료:`, counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // 추가: 컴포넌트 마운트 즉시 그룹 멤버 수 로드 (가장 우선순위)
  useEffect(() => {
    console.log(`[${instanceId.current}] 컴포넌트 마운트 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        setGroupMemberCounts({});
        return;
      }

      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회 완료:`, counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // 추가: 컴포넌트 마운트 즉시 그룹 멤버 수 로드 (가장 우선순위)
  useEffect(() => {
    console.log(`[${instanceId.current}] 컴포넌트 마운트 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        setGroupMemberCounts({});
        return;
      }

      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회 완료:`, counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // 컴포넌트 마운트 시 그룹 멤버 수 먼저 로드 (location 페이지와 동일한 방식)
  useEffect(() => {
    if (isInitialDataLoaded) {
      // userGroups가 없어도 미리 로드 시도 (location 페이지와 동일)
      if (!groupMemberCountsLoadingRef.current) {
        groupMemberCountsLoadingRef.current = true;

        const loadGroupMemberCounts = async () => {
          // userGroups가 없으면 기본 그룹들로 미리 로드
          const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

          if (groupsToLoad.length === 0) {
            console.log(`[${instanceId.current}] 그룹 목록이 아직 없어서 미리 로드 건너뜀`);
            groupMemberCountsLoadingRef.current = false;
            return;
          }

          console.log(`[${instanceId.current}] 그룹 멤버 수 조회 시작:`, groupsToLoad.length, '개 그룹');

          const counts: Record<number, number> = {};
          const now = Date.now();

          // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
          const validGroups = groupsToLoad.filter(group => {
            const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
            if (cached && (now - cached.timestamp) < CACHE_DURATION) {
              counts[group.sgt_idx] = cached.count;
              console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
              return false; // 캐시된 데이터가 있으면 API 호출하지 않음
            }
            return true; // 캐시가 없거나 만료된 경우 API 호출
          });

          if (validGroups.length > 0) {
            // 캐시되지 않은 그룹들만 병렬로 조회
            await Promise.all(validGroups.map(async (group) => {
              try {
                const count = await getGroupMemberCount(group.sgt_idx);
                counts[group.sgt_idx] = count;
                // 캐시에 저장
                groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
                console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
              } catch (error) {
                console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
                counts[group.sgt_idx] = 0;
              }
            }));
          }

          setGroupMemberCounts(counts);
          console.log(`[${instanceId.current}] 전체 그룹 멤버 수 조회 완료:`, counts);
          groupMemberCountsLoadingRef.current = false;
        };

        // 즉시 실행 (사이드바 열림과 관계없이 미리 로드)
        loadGroupMemberCounts();
      }
    }

    return () => {
      groupMemberCountsLoadingRef.current = false;
    };
  }, [isInitialDataLoaded, userGroups]);

  // 추가: 페이지 로드 시 즉시 그룹 멤버 수 로드 (location 페이지와 동일)
  useEffect(() => {
    if (!groupMemberCountsLoadingRef.current) {
      console.log(`[${instanceId.current}] 페이지 로드 시 즉시 그룹 멤버 수 로드 시작`);

      groupMemberCountsLoadingRef.current = true;

      const loadGroupMemberCounts = async () => {
        const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

        if (groupsToLoad.length === 0) {
          console.log(`[${instanceId.current}] 페이지 로드 시 그룹 목록이 없어서 건너뜀`);
          groupMemberCountsLoadingRef.current = false;
          return;
        }

        console.log(`[${instanceId.current}] 페이지 로드 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

        const counts: Record<number, number> = {};
        const now = Date.now();

        // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
        const validGroups = groupsToLoad.filter(group => {
          const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            counts[group.sgt_idx] = cached.count;
            console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
            return false;
          }
          return true;
        });

        if (validGroups.length > 0) {
          await Promise.all(validGroups.map(async (group) => {
            try {
              const count = await getGroupMemberCount(group.sgt_idx);
              counts[group.sgt_idx] = count;
              groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
              console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
            } catch (error) {
              console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            }
          }));
        }

        setGroupMemberCounts(counts);
        console.log(`[${instanceId.current}] 페이지 로드 시 그룹 멤버 수 조회 완료:`, counts);
        groupMemberCountsLoadingRef.current = false;
      };

      loadGroupMemberCounts();
    }
  }, []); // 빈 의존성 배열로 페이지 로드 시 한 번만 실행

  // 추가: 컴포넌트 마운트 즉시 그룹 멤버 수 로드 (가장 우선순위)
  useEffect(() => {
    console.log(`[${instanceId.current}] 컴포넌트 마운트 즉시 그룹 멤버 수 로드 시작`);

    const loadGroupMemberCountsImmediately = async () => {
      // userGroups가 없어도 기본 그룹들로 미리 로드 시도
      const groupsToLoad = userGroups && userGroups.length > 0 ? userGroups : [];

      if (groupsToLoad.length === 0) {
        console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 목록이 없어서 기본값 설정`);
        // 기본값으로 빈 객체 설정하여 로딩 상태 방지
        setGroupMemberCounts({});
        return;
      }

      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회:`, groupsToLoad.length, '개 그룹');

      const counts: Record<number, number> = {};
      const now = Date.now();

      // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
      const validGroups = groupsToLoad.filter(group => {
        const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          counts[group.sgt_idx] = cached.count;
          console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
          return false;
        }
        return true;
      });

      if (validGroups.length > 0) {
        await Promise.all(validGroups.map(async (group) => {
          try {
            const count = await getGroupMemberCount(group.sgt_idx);
            counts[group.sgt_idx] = count;
            groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
            console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
          } catch (error) {
            console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
            counts[group.sgt_idx] = 0;
          }
        }));
      }

      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 컴포넌트 마운트 시 그룹 멤버 수 조회 완료:`, counts);
    };

    // 즉시 실행 (다른 조건과 관계없이)
    loadGroupMemberCountsImmediately();
  }, []); // 빈 의존성 배열로 컴포넌트 마운트 시 한 번만 실행

  // 추가: userGroups가 변경될 때마다 그룹 멤버 수 다시 로드 (백업)
  useEffect(() => {
    if (userGroups && userGroups.length > 0 && !groupMemberCountsLoadingRef.current) {
      console.log(`[${instanceId.current}] userGroups 변경으로 인한 그룹 멤버 수 재로드:`, userGroups.length, '개 그룹');

      groupMemberCountsLoadingRef.current = true;

      const loadGroupMemberCounts = async () => {
        const counts: Record<number, number> = {};
        const now = Date.now();

        // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
        const validGroups = userGroups.filter(group => {
          const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            counts[group.sgt_idx] = cached.count;
            console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
            return false;
          }
          return true;
        });

        if (validGroups.length > 0) {
          await Promise.all(validGroups.map(async (group) => {
            try {
              const count = await getGroupMemberCount(group.sgt_idx);
              counts[group.sgt_idx] = count;
              groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
              console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
            } catch (error) {
              console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            }
          }));
        }

        setGroupMemberCounts(counts);
        console.log(`[${instanceId.current}] userGroups 변경으로 인한 그룹 멤버 수 조회 완료:`, counts);
        groupMemberCountsLoadingRef.current = false;
      };

      loadGroupMemberCounts();
    }
  }, [userGroups]);

  // 추가: userGroups가 변경될 때마다 즉시 그룹 멤버 수 로드 (즉시 실행)
  useEffect(() => {
    if (userGroups && userGroups.length > 0) {
      console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 로드:`, userGroups.length, '개 그룹');

      const loadGroupMemberCountsImmediately = async () => {
        const counts: Record<number, number> = {};
        const now = Date.now();

        // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
        const validGroups = userGroups.filter(group => {
          const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            counts[group.sgt_idx] = cached.count;
            console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
            return false;
          }
          return true;
        });

        if (validGroups.length > 0) {
          await Promise.all(validGroups.map(async (group) => {
            try {
              const count = await getGroupMemberCount(group.sgt_idx);
              counts[group.sgt_idx] = count;
              groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
              console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
            } catch (error) {
              console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            }
          }));
        }

        setGroupMemberCounts(counts);
        console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 조회 완료:`, counts);
      };

      // 즉시 실행 (로딩 상태와 관계없이)
      loadGroupMemberCountsImmediately();
    }
  }, [userGroups]);

  // 추가: userGroups가 변경될 때마다 즉시 그룹 멤버 수 로드 (즉시 실행)
  useEffect(() => {
    if (userGroups && userGroups.length > 0) {
      console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 로드:`, userGroups.length, '개 그룹');

      const loadGroupMemberCountsImmediately = async () => {
        const counts: Record<number, number> = {};
        const now = Date.now();

        // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
        const validGroups = userGroups.filter(group => {
          const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            counts[group.sgt_idx] = cached.count;
            console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
            return false;
          }
          return true;
        });

        if (validGroups.length > 0) {
          await Promise.all(validGroups.map(async (group) => {
            try {
              const count = await getGroupMemberCount(group.sgt_idx);
              counts[group.sgt_idx] = count;
              groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
              console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
            } catch (error) {
              console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            }
          }));
        }

        setGroupMemberCounts(counts);
        console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 조회 완료:`, counts);
      };

      // 즉시 실행 (로딩 상태와 관계없이)
      loadGroupMemberCountsImmediately();
    }
  }, [userGroups]);

  // 추가: userGroups가 변경될 때마다 즉시 그룹 멤버 수 로드 (즉시 실행)
  useEffect(() => {
    if (userGroups && userGroups.length > 0) {
      console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 로드:`, userGroups.length, '개 그룹');

      const loadGroupMemberCountsImmediately = async () => {
        const counts: Record<number, number> = {};
        const now = Date.now();

        // 캐시된 데이터가 있는지 확인하고 유효한 데이터 사용
        const validGroups = userGroups.filter(group => {
          const cached = groupMemberCountsCacheRef.current[group.sgt_idx];
          if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            counts[group.sgt_idx] = cached.count;
            console.log(`[${instanceId.current}] 캐시된 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 사용:`, cached.count);
            return false;
          }
          return true;
        });

        if (validGroups.length > 0) {
          await Promise.all(validGroups.map(async (group) => {
            try {
              const count = await getGroupMemberCount(group.sgt_idx);
              counts[group.sgt_idx] = count;
              groupMemberCountsCacheRef.current[group.sgt_idx] = { count, timestamp: now };
              console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회:`, count);
            } catch (error) {
              console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            }
          }));
        }

        setGroupMemberCounts(counts);
        console.log(`[${instanceId.current}] userGroups 변경 즉시 그룹 멤버 수 조회 완료:`, counts);
      };

      // 즉시 실행 (로딩 상태와 관계없이)
      loadGroupMemberCountsImmediately();
    }
  }, [userGroups]);

  // 그룹 멤버 수를 가져오는 함수 - 캐시 적용
  const getGroupMemberCount = async (groupId: number): Promise<number> => {
    try {
      console.log(`[${instanceId.current}] 그룹 ${groupId} 멤버 수 조회 시작`);
      const memberData = await memberService.getGroupMembers(groupId.toString());
      const count = memberData ? memberData.length : 0;
      console.log(`[${instanceId.current}] 그룹 ${groupId} 멤버 수 조회 완료: ${count}명`);
      return count;
    } catch (error) {
      console.error(`[${instanceId.current}] 그룹 ${groupId} 멤버 수 조회 실패:`, error);
      return 0;
    }
  };

  // 그룹 멤버 수 로딩 완료 시 상태 업데이트
  const updateGroupMemberCountsWithState = (counts: Record<number, number>) => {
    setGroupMemberCounts(counts);
    setIsGroupMemberCountsLoaded(true);
    console.log(`[${instanceId.current}] 그룹 멤버 수 로딩 완료 및 상태 업데이트:`, counts);
  };

  // setGroupMemberCounts를 오버라이드하여 자동으로 로딩 상태 업데이트
  const originalSetGroupMemberCounts = setGroupMemberCounts;
  const enhancedSetGroupMemberCounts = (counts: Record<number, number>) => {
    originalSetGroupMemberCounts(counts);
    setIsGroupMemberCountsLoaded(true);
    console.log(`[${instanceId.current}] 그룹 멤버 수 로딩 완료:`, counts);
  };

  // 캐시 무효화 함수
  const invalidateGroupMemberCountsCache = (groupId?: number) => {
    if (groupId) {
      delete groupMemberCountsCacheRef.current[groupId];
      console.log(`[${instanceId.current}] 그룹 ${groupId} 멤버 수 캐시 무효화`);
    } else {
      groupMemberCountsCacheRef.current = {};
      console.log(`[${instanceId.current}] 모든 그룹 멤버 수 캐시 무효화`);
    }
  };

  // groupMemberCounts가 업데이트될 때마다 자동으로 로딩 상태를 true로 설정
  useEffect(() => {
    if (Object.keys(groupMemberCounts).length > 0) {
      setIsGroupMemberCountsLoaded(true);
      console.log(`[${instanceId.current}] 그룹 멤버 수 업데이트로 인한 로딩 완료 상태 설정`);
    }
  }, [groupMemberCounts]);

  // 그룹 선택 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isGroupSelectorOpen && groupDropdownRef.current) {
        const target = event.target as Node;

        if (!groupDropdownRef.current.contains(target)) {
          console.log('[그룹 드롭다운] 외부 클릭으로 드롭다운 닫기');
          setIsGroupSelectorOpen(false);
        }
      }
    };

    if (isGroupSelectorOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isGroupSelectorOpen]);

  // 사이드바 날짜 스크롤 함수
  const scrollSidebarDateToToday = () => {
    if (sidebarDateX) {
      const recentDays = getRecentDays();
      const totalWidth = recentDays.length * 85; // 각 버튼 width (min-w-[75px] + gap)
      const containerWidth = 200; // 컨테이너 width
      const maxScroll = Math.max(0, totalWidth - containerWidth);

      // 오늘이 맨 오른쪽에 있으므로 최대한 왼쪽으로 스크롤
      sidebarDateX.set(-maxScroll);

      // 오늘 날짜 인덱스를 마지막 스크롤 위치로 설정
      const todayIndex = recentDays.findIndex(day => day.value === format(new Date(), 'yyyy-MM-dd'));
      if (todayIndex !== -1) {
        lastScrolledIndexRef.current = todayIndex;
      }

      console.log('[사이드바 날짜] 오늘 날짜로 스크롤 완료', { totalWidth, containerWidth, maxScroll, todayIndex });
    }
  };

  // 선택된 멤버로 스크롤하는 함수
  const scrollToSelectedMember = (reason?: string) => {
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember && sidebarRef.current) {
      const memberElement = sidebarRef.current.querySelector(`#member-${selectedMember.id}`);
      if (memberElement) {
        memberElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        console.log(`[scrollToSelectedMember] 선택된 멤버(${selectedMember.name})로 스크롤 - ${reason || '일반'}`);
      } else {
        console.log(`[scrollToSelectedMember] 멤버 요소를 찾을 수 없음: member-${selectedMember.id}`);
      }
    } else {
      console.log('[scrollToSelectedMember] 선택된 멤버가 없거나 사이드바 ref가 없음');
    }
  };

  // 사이드바 날짜를 선택된 날짜로 스크롤하는 함수
  const scrollSidebarDateToSelected = (targetDate?: string) => {
    const dateToScroll = targetDate || selectedDate;
    console.log(`[사이드바 날짜] 스크롤 시도: ${dateToScroll}, sidebarDateX 존재: ${!!sidebarDateX}`);

    if (sidebarDateX && dateToScroll) {
      const recentDays = getRecentDays();
      const targetIndex = recentDays.findIndex(day => day.value === dateToScroll);

      console.log(`[사이드바 날짜] 날짜 검색 결과: ${dateToScroll} -> 인덱스 ${targetIndex}, 전체 날짜 수: ${recentDays.length}`);

      if (targetIndex !== -1) {
        const itemWidth = 85; // 각 버튼 width (min-w-[75px] + gap)
        const containerWidth = 200; // 컨테이너 width
        const totalWidth = recentDays.length * itemWidth;
        const maxScroll = Math.max(0, totalWidth - containerWidth);

        // 선택된 날짜가 중앙에 오도록 스크롤 위치 계산
        const targetScroll = Math.min(maxScroll, Math.max(0, (targetIndex * itemWidth) - (containerWidth / 2) + (itemWidth / 2)));

        sidebarDateX.set(-targetScroll);
        lastScrolledIndexRef.current = targetIndex;

        console.log(`[사이드바 날짜] ✅ 선택된 날짜(${dateToScroll})로 스크롤 완료`, {
          targetIndex,
          targetScroll,
          totalWidth,
          containerWidth,
          maxScroll
        });
      } else {
        // 선택된 날짜가 범위에 없으면 오늘 날짜로 폴백
        console.log(`[사이드바 날짜] ⚠️ 선택된 날짜(${dateToScroll})가 범위에 없음. 범위: ${recentDays[0]?.value} ~ ${recentDays[recentDays.length - 1]?.value}`);
        scrollSidebarDateToToday();
        console.log(`[사이드바 날짜] 오늘 날짜로 폴백 완료`);
      }
    } else {
      console.warn(`[사이드바 날짜] 스크롤 불가: sidebarDateX=${!!sidebarDateX}, dateToScroll=${dateToScroll}`);
    }
  };

  // 사이드바 토글 함수 - 플로팅 버튼 전용
  const toggleSidebar = useCallback(() => {
    // 닫기 중이면 토글 무시
    if (sidebarClosingRef.current) {
      console.log('[사이드바] 닫기 중 - 플로팅 버튼 토글 무시');
      return;
    }

    const wasOpen = isSidebarOpen;

    if (wasOpen) {
      // 닫기 상태 설정하여 중복 처리 방지
      sidebarClosingRef.current = true;

      setIsSidebarOpen(false);
      console.log('[사이드바] 플로팅 버튼으로 닫기');

      // 일정 시간 후 닫기 상태 해제
      setTimeout(() => {
        sidebarClosingRef.current = false;
      }, 500);
    } else {
      // 그룹 멤버 수가 로드된 후에만 사이드바 열기
      if (isGroupMemberCountsLoaded) {
        setIsSidebarOpen(true);
        console.log('[사이드바] 플로팅 버튼으로 열기');
      } else {
        console.log('[사이드바] 그룹 멤버 수 로딩 중이므로 대기');
        // 그룹 멤버 수 로딩이 완료될 때까지 대기
        const checkLoading = () => {
          if (isGroupMemberCountsLoaded) {
            setIsSidebarOpen(true);
            console.log('[사이드바] 그룹 멤버 수 로딩 완료 후 열기');
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      }
      // 사이드바가 열릴 때 선택된 멤버로 스크롤하고 선택된 날짜로 스크롤 조정
      setTimeout(() => {
        // 사이드바 날짜 스크롤을 선택된 날짜로 조정
        scrollSidebarDateToSelected();

        // 메인 날짜 선택기도 선택된 날짜로 스크롤
        if (selectedDate) {
          scrollToSelectedDate(selectedDate, '사이드바 열림');
        } else {
          scrollToTodayDate('사이드바 열림');
        }

        // 선택된 멤버로 스크롤 (날짜 스크롤 후에 실행)
        setTimeout(() => {
          scrollToSelectedMember('사이드바 열림');
        }, 200);
      }, 100); // 사이드바 애니메이션 시작 후 바로 실행
    }
  }, [isSidebarOpen, setIsSidebarOpen, scrollSidebarDateToSelected, scrollToSelectedDate, scrollToTodayDate, scrollToSelectedMember, selectedDate]);

  // 사이드바 외부 클릭 처리
  const sidebarClosingRef = useRef(false);

  useEffect(() => {
    const handleSidebarClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;

      // 닫기 버튼 클릭인지 확인
      if (target.closest('[data-sidebar-close-button="true"]')) {
        console.log('[사이드바] 닫기 버튼 클릭 감지 - 외부 클릭 처리 무시');
        return;
      }

      // 사이드바가 닫히는 중이면 외부 클릭 무시
      if (sidebarClosingRef.current) {
        console.log('[사이드바] 닫기 중 - 외부 클릭 처리 무시');
        return;
      }

      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(target)) {
        console.log('[사이드바] 외부 클릭/터치 감지 - 사이드바 닫기');

        // 닫기 상태 설정하여 중복 처리 방지
        sidebarClosingRef.current = true;

        // 사이드바 닫기
        setIsSidebarOpen(false);

        // 일정 시간 후 닫기 상태 해제
        setTimeout(() => {
          sidebarClosingRef.current = false;
        }, 500);
      }
    };

    if (isSidebarOpen) {
      // 마우스와 터치 이벤트 모두 처리하여 확실한 외부 클릭 감지
      document.addEventListener('mousedown', handleSidebarClickOutside, { passive: false });
      document.addEventListener('touchstart', handleSidebarClickOutside, { passive: false });
    } else {
      document.removeEventListener('mousedown', handleSidebarClickOutside);
      document.removeEventListener('touchstart', handleSidebarClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleSidebarClickOutside);
      document.removeEventListener('touchstart', handleSidebarClickOutside);
    };
  }, [isSidebarOpen]);

  // 사이드바가 열릴 때 선택된 날짜로 스크롤 (일별 카운트 데이터는 이미 로드되어 있음)
  useEffect(() => {
    if (isSidebarOpen) {
      // 일별 카운트 데이터가 이미 로드되어 있으므로 즉시 스크롤 실행
      setTimeout(() => {
        // 선택된 날짜가 있으면 해당 날짜로, 없으면 오늘 날짜로 스크롤
        if (selectedDate) {
          scrollSidebarDateToSelected(selectedDate);
          console.log(`[사이드바] 열릴 때 선택된 날짜로 스크롤: ${selectedDate}`);
        } else {
          scrollSidebarDateToToday();
          console.log(`[사이드바] 열릴 때 오늘 날짜로 스크롤 (선택된 날짜 없음)`);
        }
      }, 30); // 지연 시간 더 단축 (일별 카운트 데이터가 이미 준비되어 있음)
    }
  }, [isSidebarOpen, selectedDate]);

  // 첫번째 멤버 자동 선택 및 위치 데이터 로딩 - 메인 인스턴스에서만
  // 첫번째 멤버 자동 선택 - 위의 통합 useEffect에서 처리하므로 제거

  // 선택된 멤버가 변경될 때 위치 데이터 자동 로드 - 비활성화 (중복 호출 방지)
  // useEffect(() => {
  //   const selectedMember = groupMembers.find(m => m.isSelected);
  //   if (selectedMember && selectedDate && !loadLocationDataExecutingRef.current.executing) {
  //     console.log('[LOGS] 선택된 멤버 변경 감지 - 위치 데이터 로드:', selectedMember.name, selectedDate);
  //     loadLocationData(parseInt(selectedMember.id), selectedDate);
  //   }
  // }, [groupMembers.map(m => m.isSelected).join(',')]);

  // dailyCountsData가 로드된 후 초기 진입 시에만 최근 활동 날짜로 자동 선택 (성능 최적화)
  useEffect(() => {
    if (dailyCountsData && groupMembers.length > 0 && isInitialEntry) {
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        console.log(`[LOGS] 초기 진입 - dailyCountsData 로드 완료: ${selectedMember.name}`);

        try {
          // 초기 진입 시에만 최근 활동 날짜로 자동 변경
          const memberMtIdx = parseInt(selectedMember.id);
          const memberData = dailyCountsData.member_daily_counts?.find(
            member => member.member_id === memberMtIdx
          );

          if (memberData?.daily_counts && Array.isArray(memberData.daily_counts)) {
            // 최근 15일 동안 활동이 있는 가장 최근 날짜 찾기 (더 안정적으로)
            const recentDays = Array.from({ length: 15 }, (_, i) => {
              const date = subDays(new Date(), 14 - i);
              return format(date, 'yyyy-MM-dd');
            });

            let foundRecentDate = null;
            for (let i = recentDays.length - 1; i >= 0; i--) {
              const dateString = recentDays[i];
              try {
                const shortDateString = format(new Date(dateString), 'MM.dd');
                const dayData = memberData.daily_counts.find(
                  day => day.formatted_date === shortDateString
                );

                if (dayData && dayData.count > 0) {
                  foundRecentDate = dateString;
                  console.log(`[LOGS] 초기 진입 - 최근 활동 날짜 발견: ${dateString} (${dayData.count}건)`);
                  break;
                }
              } catch (dateError) {
                console.warn(`[LOGS] 날짜 처리 오류 (${dateString}):`, dateError);
                continue;
              }
            }

            if (foundRecentDate && foundRecentDate !== selectedDate) {
              console.log(`[LOGS] 초기 진입 - 날짜 자동 변경: ${selectedDate} → ${foundRecentDate}`);
              setSelectedDate(foundRecentDate);

              // 사이드바 날짜도 동기화
              setTimeout(() => {
                scrollSidebarDateToSelected(foundRecentDate);
                console.log(`[LOGS] 초기 진입 - 사이드바 날짜 동기화 완료: ${foundRecentDate}`);
              }, 100);
            } else if (foundRecentDate) {
              // 날짜는 같지만 사이드바 동기화 확인
              console.log(`[LOGS] 초기 진입 - 날짜 일치 확인: ${foundRecentDate}`);
              setTimeout(() => {
                scrollSidebarDateToSelected(foundRecentDate);
                console.log(`[LOGS] 초기 진입 - 사이드바 날짜 동기화 확인 완료: ${foundRecentDate}`);
              }, 100);
            } else {
              // 활동 날짜가 없으면 오늘 날짜로 설정
              const todayDate = format(new Date(), 'yyyy-MM-dd');
              console.log(`[LOGS] 초기 진입 - 활동 날짜 없음, 오늘 날짜로 설정: ${todayDate}`);
              setSelectedDate(todayDate);

              setTimeout(() => {
                scrollSidebarDateToToday();
                console.log(`[LOGS] 초기 진입 - 사이드바 오늘 날짜로 동기화 완료`);
              }, 100);
            }
          } else {
            console.warn(`[LOGS] 초기 진입 - memberData 또는 daily_counts가 유효하지 않음:`, memberData);
            // 데이터가 없어도 기본 위치 데이터는 로딩 시도
            setTimeout(() => {
              if (!loadLocationDataExecutingRef.current.executing) {
                console.log(`[LOGS] 초기 진입 - 백업 위치 데이터 로딩`);
                loadLocationData(memberMtIdx, selectedDate);
              }
            }, 200);
          }
        } catch (error) {
          console.error(`[LOGS] 초기 진입 처리 중 오류:`, error);
          // 오류 발생해도 기본 위치 데이터는 로딩 시도
          const memberMtIdx = parseInt(selectedMember.id);
          setTimeout(() => {
            if (!loadLocationDataExecutingRef.current.executing) {
              console.log(`[LOGS] 초기 진입 - 오류 복구 위치 데이터 로딩`);
              loadLocationData(memberMtIdx, selectedDate);
            }
          }, 300);
        }

        // 초기 진입 플래그 해제
        setIsInitialEntry(false);
      }
    } else if (dailyCountsData && groupMembers.length > 0 && !isInitialEntry) {
      // 초기 진입 이후에는 자동 날짜 변경 없이 현재 날짜 데이터만 확인
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        console.log(`[LOGS] 일반 사용 - 현재 날짜(${selectedDate}) 데이터 확인`);

        try {
          const memberMtIdx = parseInt(selectedMember.id);
          const memberData = dailyCountsData.member_daily_counts?.find(
            member => member.member_id === memberMtIdx
          );

          if (memberData?.daily_counts) {
            const shortDateString = format(new Date(selectedDate), 'MM.dd');
            const dayData = memberData.daily_counts.find(
              day => day.formatted_date === shortDateString
            );

            if (dayData && dayData.count > 0) {
              console.log(`[LOGS] ✅ 일별 카운트에 현재 날짜(${selectedDate}) 데이터 있음: ${dayData.count}건`);
              // 실제 지도 마커 데이터도 확인
              if (mapMarkersData && mapMarkersData.length > 0) {
                console.log(`[LOGS] ✅ 지도 마커 데이터도 있음: ${mapMarkersData.length}개 - 모든 데이터 준비 완료`);
              } else {
                console.log(`[LOGS] ⏳ 지도 마커 데이터 로딩 중... (일별 카운트: ${dayData.count}건)`);
              }
            } else {
              // 일별 카운트에 없어도 지도 마커 데이터가 있을 수 있음
              if (mapMarkersData && mapMarkersData.length > 0) {
                console.log(`[LOGS] ✅ 일별 카운트에는 없지만 지도 마커 데이터 있음: ${mapMarkersData.length}개`);
              } else {
                console.log(`[LOGS] ⚠️ 현재 선택된 날짜(${selectedDate})에 데이터 없음 (일별/지도 모두)`);

                // 데이터가 없으면 최근 활동 날짜로 자동 변경
                const recentDays = Array.from({ length: 15 }, (_, i) => {
                  const date = subDays(new Date(), 14 - i);
                  return format(date, 'yyyy-MM-dd');
                });

                let foundRecentDate = null;
                for (let i = recentDays.length - 1; i >= 0; i--) {
                  const dateString = recentDays[i];
                  const shortDate = format(new Date(dateString), 'MM.dd');
                  const dayData = memberData.daily_counts.find(
                    day => day.formatted_date === shortDate
                  );

                  if (dayData && dayData.count > 0) {
                    foundRecentDate = dateString;
                    break;
                  }
                }

                if (foundRecentDate && foundRecentDate !== selectedDate) {
                  console.log(`[LOGS] 날짜 동기화 - 자동 변경: ${selectedDate} → ${foundRecentDate}`);
                  setSelectedDate(foundRecentDate);

                  // 사이드바 날짜도 동기화
                  setTimeout(() => {
                    scrollSidebarDateToSelected(foundRecentDate);
                    console.log(`[LOGS] 날짜 동기화 - 사이드바 업데이트 완료: ${foundRecentDate}`);
                  }, 100);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[LOGS] 일반 사용 데이터 확인 중 오류:`, error);
        }
      }
    }
  }, [dailyCountsData, groupMembers, isInitialEntry]);

  // dailyCountsData와 selectedDate 동기화 확인 및 수정
  useEffect(() => {
    if (dailyCountsData && selectedDate && !isInitialEntry) {
      console.log(`[LOGS] 날짜 동기화 확인 - selectedDate: ${selectedDate}`);

      // 선택된 멤버의 해당 날짜 데이터 확인
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        const memberMtIdx = parseInt(selectedMember.id);
        const memberData = dailyCountsData.member_daily_counts?.find(
          member => member.member_id === memberMtIdx
        );

        if (memberData?.daily_counts) {
          const shortDateString = format(new Date(selectedDate), 'MM.dd');
          const dayData = memberData.daily_counts.find(
            day => day.formatted_date === shortDateString
          );

          // 해당 날짜에 데이터가 없으면 최근 활동 날짜로 자동 변경
          if (!dayData || dayData.count === 0) {
            console.log(`[LOGS] 날짜 동기화 - ${selectedDate}에 데이터 없음, 최근 활동 날짜로 변경`);

            // 최근 활동 날짜 찾기
            const recentDays = Array.from({ length: 15 }, (_, i) => {
              const date = subDays(new Date(), 14 - i);
              return format(date, 'yyyy-MM-dd');
            });

            let foundRecentDate = null;
            for (let i = recentDays.length - 1; i >= 0; i--) {
              const dateString = recentDays[i];
              const shortDate = format(new Date(dateString), 'MM.dd');
              const dayData = memberData.daily_counts.find(
                day => day.formatted_date === shortDate
              );

              if (dayData && dayData.count > 0) {
                foundRecentDate = dateString;
                break;
              }
            }

            if (foundRecentDate && foundRecentDate !== selectedDate) {
              console.log(`[LOGS] 날짜 동기화 - 자동 변경: ${selectedDate} → ${foundRecentDate}`);
              setSelectedDate(foundRecentDate);

              // 사이드바 날짜도 동기화
              setTimeout(() => {
                scrollSidebarDateToSelected(foundRecentDate);
                console.log(`[LOGS] 날짜 동기화 - 사이드바 업데이트 완료: ${foundRecentDate}`);
              }, 100);
            }
          } else {
            // 데이터가 있으면 사이드바 동기화만 확인
            console.log(`[LOGS] 날짜 동기화 - ${selectedDate}에 데이터 확인됨 (${dayData.count}건)`);
            setTimeout(() => {
              scrollSidebarDateToSelected(selectedDate);
              console.log(`[LOGS] 날짜 동기화 - 사이드바 동기화 확인 완료: ${selectedDate}`);
            }, 100);
          }
        }
      }
    }
  }, [dailyCountsData, selectedDate, groupMembers, isInitialEntry]);

  // 🚨 NEW: mapMarkersData 변경 감지 및 실시간 디버깅 업데이트
  useEffect(() => {
    console.log('[LOGS] 🔄 지도 마커 데이터 변경 감지:', {
      isMapInitializedActivelog: !!map.current,
      mapMarkersDataLength: mapMarkersData?.length || 0,
      mapMarkersData: mapMarkersData || [],
      isDateChanging: isDateChangingRef.current
    });

    if (mapMarkersData && mapMarkersData.length > 0) {
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        console.log(`[LOGS] ✅ 지도 마커 데이터 로딩 완료: ${mapMarkersData.length}개 - 멤버: ${selectedMember.name} - 날짜: ${selectedDate}`);

        // 해당 날짜의 일별 카운트도 다시 확인
        if (dailyCountsData && Array.isArray(dailyCountsData)) {
          const memberMtIdx = parseInt(selectedMember.id);
          const memberData = dailyCountsData.member_daily_counts?.find(
            member => member.member_id === memberMtIdx
          );

          if (memberData?.daily_counts) {
            const shortDateString = format(new Date(selectedDate), 'MM.dd');
            const dayData = memberData.daily_counts.find(
              day => day.formatted_date === shortDateString
            );

            if (dayData && dayData.count > 0) {
              console.log(`[LOGS] 🎯 완전한 데이터 확인: 일별카운트 ${dayData.count}건 + 지도마커 ${mapMarkersData.length}개`);
            } else {
              console.log(`[LOGS] 🤔 일별카운트에는 없지만 지도마커는 있음: ${mapMarkersData.length}개`);
            }
          }
        }
      }
    } else if (map.current) {
      console.log('[LOGS] ⚠️ 지도가 초기화되지 않아서 마커 업데이트 건너뜀');
    }
  }, [mapMarkersData, selectedDate, groupMembers, dailyCountsData]);

  // 날짜나 멤버 변경 시 위치기록 요약 초기화 - 완전히 비활성화 (handleMemberSelect/handleDateSelect에서 직접 처리)
  useEffect(() => {
    const selectedMember = groupMembers.find(m => m.isSelected);
    console.log('[useEffect] 날짜/멤버 변경 감지:', {
      selectedDate,
      selectedMember: selectedMember?.name,
      currentSummary: locationSummary,
      isLocationDataLoading
    });

    // 자동 초기화 비활성화 - handleMemberSelect와 handleDateSelect에서 명시적으로 처리
    // if (isLocationDataLoading && 
    //     (locationSummary.distance !== '0 km' || locationSummary.time !== '0분' || locationSummary.steps !== '0 걸음')) {
    //   setLocationSummary(DEFAULT_LOCATION_SUMMARY);
    //   console.log('[useEffect] 위치기록 요약 초기화 완료 (새 데이터 로딩 시작)');
    // }
  }, [selectedDate, groupMembers.find(m => m.isSelected)?.id, isLocationDataLoading]);

  // 컴포넌트 언마운트 시 이벤트 리스너 정리
  useEffect(() => {
    return () => {
      // 모든 글로벌 이벤트 리스너 정리
      const events = ['mousemove', 'mouseup', 'touchmove', 'touchend'];
      events.forEach(event => {
        document.removeEventListener(event, () => { });
      });
      console.log('[useEffect] 컴포넌트 언마운트 - 이벤트 리스너 정리');
    };
  }, []);

  // selectedDate가 변경될 때 위치 데이터 자동 로드 (자동 선택 후 보조 로직) - 비활성화
  // useEffect(() => {
  //   const selectedMember = groupMembers.find(m => m.isSelected);
  //   if (selectedMember && selectedDate && groupMembers.length > 0) {
  //     console.log('[LOGS] selectedDate useEffect - 보조 로딩 비활성화됨');
  //   }
  // }, [selectedDate]);

  // 지도 렌더링 재시도 카운터 ref
  const mapRenderRetryCountRef = useRef<{ [key: string]: number }>({});

  // 지도 렌더링 검증 및 재시도 함수
  const verifyAndRetryMapRendering = async (mapMarkers: MapMarker[], stayTimes: StayTime[], locationLogSummary: LocationLogSummary | null, members: GroupMember[], mtIdx: number, date: string) => {
    if (!map.current || !window.naver?.maps) {
      console.log('[verifyAndRetryMapRendering] 지도 미준비 - 검증 건너뜀');
      return;
    }

    // 네모 캘린더에 데이터가 있는지 확인
    const selectedMember = members.find(m => m.isSelected);
    if (!selectedMember) {
      console.log('[verifyAndRetryMapRendering] 선택된 멤버 없음 - 검증 건너뜀');
      return;
    }

    const memberId = selectedMember.id;
    const hasCalendarData = dailyCountsData && Array.isArray(dailyCountsData) ?
      dailyCountsData.some((memberData: any) =>
        memberData.member_id.toString() === memberId &&
        memberData.daily_counts.some((dayData: any) => dayData.date === date && dayData.count > 0)
      ) : false;

    if (!hasCalendarData) {
      console.log('[verifyAndRetryMapRendering] 네모 캘린더에 데이터 없음 - 검증 건너뜀');
      return;
    }

    // 지도에 실제로 마커가 표시되어 있는지 확인
    const hasVisibleMarkers = locationLogMarkers.current.length > 0 ||
      startEndMarkers.current.length > 0 ||
      stayTimeMarkers.current.length > 0;

    console.log('[verifyAndRetryMapRendering] 마커 표시 상태 검증:', {
      hasCalendarData,
      expectedMarkers: mapMarkers.length,
      visibleLocationMarkers: locationLogMarkers.current.length,
      visibleStartEndMarkers: startEndMarkers.current.length,
      visibleStayMarkers: stayTimeMarkers.current.length,
      hasVisibleMarkers,
      selectedMember: selectedMember.name,
      date
    });

    // 네모 캘린더에는 데이터가 있지만 지도에 마커가 없으면 재시도
    if (hasCalendarData && mapMarkers.length > 0 && !hasVisibleMarkers) {
      console.warn('[verifyAndRetryMapRendering] 🔄 데이터는 있지만 지도에 마커 없음 - 자동 재시도 시작');

      // 재시도 카운터 확인 (무한 루프 방지)
      const retryKey = `${mtIdx}-${date}`;
      const currentRetryCount = mapRenderRetryCountRef.current[retryKey] || 0;

      if (currentRetryCount >= 2) {
        console.error('[verifyAndRetryMapRendering] 최대 재시도 횟수 초과 (2회) - 재시도 중단');
        return;
      }

      mapRenderRetryCountRef.current[retryKey] = currentRetryCount + 1;
      console.log(`[verifyAndRetryMapRendering] 재시도 ${currentRetryCount + 1}/2 시작`);

      // 지도 완전 정리 후 재렌더링
      try {
        clearMapMarkersAndPaths(true, false, false); // 새로고침 없이 정리

        setTimeout(async () => {
          try {
            console.log('[verifyAndRetryMapRendering] 🗺️ 재시도 렌더링 시작');
            await renderLocationDataOnMap(mapMarkers, stayTimes, locationLogSummary, members, map.current);
            console.log('[verifyAndRetryMapRendering] ✅ 재시도 렌더링 완료');

            // 재시도 성공 시 카운터 리셋
            delete mapRenderRetryCountRef.current[retryKey];
          } catch (retryError) {
            console.error('[verifyAndRetryMapRendering] ❌ 재시도 렌더링 실패:', retryError);
          }
        }, 300);

      } catch (error) {
        console.error('[verifyAndRetryMapRendering] 재시도 중 오류:', error);
      }
    } else if (hasVisibleMarkers) {
      console.log('[verifyAndRetryMapRendering] ✅ 지도에 마커가 정상적으로 표시됨');
      // 성공 시 재시도 카운터 리셋
      const retryKey = `${mtIdx}-${date}`;
      if (mapRenderRetryCountRef.current[retryKey]) {
        delete mapRenderRetryCountRef.current[retryKey];
      }
    }
  };

  // --- 새로운 통합 지도 렌더링 함수 ---
  const renderLocationDataOnMap = async (locationMarkersData: MapMarker[], stayTimesData: StayTime[], locationLogSummaryData: LocationLogSummary | null, groupMembers: GroupMember[], mapInstance: any) => {
    if (!mapInstance || !window.naver?.maps) {
      console.log('[renderLocationDataOnMap] ❌ 지도가 준비되지 않음:', {
        mapInstance: !!mapInstance,
        naverMaps: !!window.naver?.maps
      });
      return;
    }

    console.log('[renderLocationDataOnMap] 🎯 통합 지도 렌더링 시작');
    console.log('[renderLocationDataOnMap] 📊 입력 데이터 확인:', {
      locationMarkersData: locationMarkersData?.length || 0,
      stayTimesData: stayTimesData?.length || 0,
      locationLogSummaryData: !!locationLogSummaryData,
      groupMembers: groupMembers?.length || 0
    });

    // 마커 데이터가 비어있는 경우 별도 처리
    if (!locationMarkersData || locationMarkersData.length === 0) {
      console.warn('[renderLocationDataOnMap] ⚠️ 위치 마커 데이터가 비어있음 - 지도 정리 수행');
      clearMapMarkersAndPaths(true);

      // 빈 데이터일 때도 체류지점이 있으면 표시
      if (stayTimesData && stayTimesData.length > 0) {
        console.log('[renderLocationDataOnMap] 📍 마커 데이터는 없지만 체류지점 데이터 있음 - 체류지점만 표시:', stayTimesData.length);
        // 체류지점만 표시하는 로직은 아래에서 계속 진행
      } else {
        console.log('[renderLocationDataOnMap] 📍 마커 데이터와 체류지점 데이터 모두 없음 - 렌더링 종료');
        return;
      }
    } else {
      console.log('[renderLocationDataOnMap] ✅ 위치 마커 데이터 확인됨 - 렌더링 계속 진행');
    }

    // 1. 지도 완전히 정리 (멤버 마커 포함) - 단, 새로고침은 하지 않음
    clearMapMarkersAndPaths(true, false, false); // refreshMap=false로 설정하여 새로고침 방지

    // 2. 지도 중심 위치를 시작위치로 설정 (마커 생성 전에)
    console.log('[renderLocationDataOnMap] 지도 중심 위치 계산 시작');
    let mapCenter = null;

    // 위치 데이터가 있으면 시작위치로 지도 중심 설정
    if (locationMarkersData && locationMarkersData.length > 0) {
      const firstMarker = locationMarkersData[0];
      const startLat = firstMarker.latitude || firstMarker.mlt_lat;
      const startLng = firstMarker.longitude || firstMarker.mlt_long;

      if (startLat && startLng) {
        mapCenter = new window.naver.maps.LatLng(Number(startLat), Number(startLng));
        mapInstance.setCenter(mapCenter);
        mapInstance.setZoom(16);
        console.log('[renderLocationDataOnMap] 지도 중심을 시작위치로 설정:', {
          lat: startLat, lng: startLng
        });
      }
    } else if (stayTimesData && stayTimesData.length > 0) {
      // 위치 데이터가 없지만 체류지점이 있으면 첫 번째 체류지점으로 중심 설정
      const firstStayPoint = stayTimesData[0];
      const stayLat = firstStayPoint.latitude || firstStayPoint.start_lat || 0;
      const stayLng = firstStayPoint.longitude || firstStayPoint.start_long || 0;

      if (stayLat && stayLng) {
        mapCenter = new window.naver.maps.LatLng(Number(stayLat), Number(stayLng));
        mapInstance.setCenter(mapCenter);
        mapInstance.setZoom(16);
        console.log('[renderLocationDataOnMap] 지도 중심을 체류지점으로 설정:', {
          lat: stayLat, lng: stayLng
        });
      }
    } else {
      console.log('[renderLocationDataOnMap] 위치 데이터와 체류지점 데이터 모두 없음 - 지도 중심 유지');
    }

    // 2. 멤버 마커는 더 이상 사용하지 않음
    memberNaverMarkers.current = []; // 멤버 마커 초기화
    console.log('[renderLocationDataOnMap] 멤버 마커 기능 비활성화됨');

    // 3. 위치 로그와 체류지점을 시간 순서로 통합 및 정렬
    console.log('[renderLocationDataOnMap] 위치 로그 및 체류지점 통합/정렬 시작');
    const allTimePoints: Array<{
      type: 'location' | 'stay';
      data: any;
      lat: number;
      lng: number;
      time: string;
      sortKey: number; // mlt_idx 또는 시간
    }> = [];

    // 위치 로그 데이터 추가
    locationMarkersData.forEach((markerData, index) => {
      const lat = markerData.latitude || markerData.mlt_lat;
      const lng = markerData.longitude || markerData.mlt_long;
      const time = markerData.timestamp || markerData.mlt_gps_time || new Date().toISOString();
      const sortKey = markerData.id || markerData.mlt_idx || index;

      if (!lat || !lng) return;

      allTimePoints.push({ type: 'location', data: markerData, lat: Number(lat), lng: Number(lng), time: time, sortKey: Number(sortKey) });
    });

    // 체류지점 데이터 추가
    stayTimesData.forEach((stayData) => {
      const lat = stayData.latitude || stayData.start_lat || 0;
      const lng = stayData.longitude || stayData.start_long || 0;
      if (!lat || !lng) return;
      allTimePoints.push({ type: 'stay', data: stayData, lat: Number(lat), lng: Number(lng), time: stayData.start_time, sortKey: new Date(stayData.start_time).getTime() });
    });

    // 시간 순서로 정렬 (mlt_idx와 시간을 모두 고려)
    const sortedTimePoints = allTimePoints.sort((a, b) => {
      // 위치 로그끼리는 mlt_idx로 정렬 (mlt_idx가 없는 경우는 timestamp로 대체)
      if (a.type === 'location' && b.type === 'location') {
        const keyA = a.data.mlt_idx !== undefined ? a.sortKey : new Date(a.time).getTime();
        const keyB = b.data.mlt_idx !== undefined ? b.sortKey : new Date(b.time).getTime();
        // 유효한 mlt_idx가 있는 경우 mlt_idx로 정렬, 아니면 시간으로 정렬
        if (a.data.mlt_idx !== undefined && b.data.mlt_idx !== undefined) return a.sortKey - b.sortKey;
        return keyA - keyB;
      }
      // 다른 타입 또는 mlt_idx가 없는 경우는 시간으로 비교
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeA - timeB;
    });

    // 위치 로그만 따로 추출 (마커 생성용)
    const sortedLocationMarkers = sortedTimePoints
      .filter(point => point.type === 'location')
      .map(point => point.data);

    // 경로따라가기용 정렬된 데이터 저장
    setSortedLocationData(sortedLocationMarkers);
    console.log('[renderLocationDataOnMap] 위치 로그 및 체류지점 통합/정렬 완료:', sortedTimePoints.length, '개 지점');

    // 4. 시작/종료 마커 생성
    console.log('[renderLocationDataOnMap] 시작/종료 마커 생성 시작');
    startEndMarkers.current = []; // 기존 시작/종료 마커 초기화
    if (sortedTimePoints.length > 0) {
      const startPoint = sortedTimePoints[0];
      const endPoint = sortedTimePoints[sortedTimePoints.length - 1];

      // 시작점 마커 (초록색 원형 마커)
      const startPosition = new window.naver.maps.LatLng(startPoint.lat, startPoint.lng);
      const startIcon = new window.naver.maps.Marker({ position: startPosition, map: mapInstance, icon: { content: `<div style="width: 20px; height: 20px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; color: white;">S</div>`, anchor: new window.naver.maps.Point(13, 13) }, zIndex: 300 });

      // 시작점 InfoWindow (모바일 Safari 호환성 강화)
      const startInfoWindow = new window.naver.maps.InfoWindow({
        content: `<style>
          @keyframes slideInFromBottom { 
            0% { opacity: 0; transform: translateY(20px) scale(0.95); } 
            100% { opacity: 1; transform: translateY(0) scale(1); }
          } 
          .info-window-container { 
            animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
            -webkit-text-size-adjust: 100% !important;
            -webkit-font-smoothing: antialiased;
          } 
          .close-button { transition: all 0.2s ease; } 
          .close-button:hover { background: rgba(0, 0, 0, 0.2) !important; transform: scale(1.1); }
          /* 모바일 Safari 텍스트 색상 강제 설정 */
          .info-window-container * {
            color-scheme: light !important;
            -webkit-text-fill-color: initial !important;
          }
        </style><div class="info-window-container" style="
          padding: 12px 16px; 
          min-width: 200px; 
          max-width: 280px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: white !important; 
          border-radius: 12px; 
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
          position: relative;
          color-scheme: light !important;
        "><button class="close-button" onclick="this.parentElement.parentElement.style.display='none'; event.stopPropagation();" style="
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
          color: #666 !important;
          -webkit-text-fill-color: #666 !important;
        ">×</button><h3 style="
          margin: 0 0 8px 0; 
          font-size: 14px; 
          font-weight: 600; 
          color: #22c55e !important; 
          padding-right: 25px; 
          text-align: center;
          -webkit-text-fill-color: #22c55e !important;
        ">🚀 시작 지점</h3><div style="margin-bottom: 6px;"><p style="
          margin: 0; 
          font-size: 12px; 
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
        ">🕒 시간: <span style="
          color: #111827 !important; 
          font-weight: 500;
          -webkit-text-fill-color: #111827 !important;
        ">${startPoint.time ? startPoint.time.split(' ')[1] || startPoint.time : '정보 없음'}</span></p></div><div style="margin-bottom: 6px;"><p style="
          margin: 0; 
          font-size: 12px; 
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
        ">🚶 속도: <span style="
          color: #111827 !important; 
          font-weight: 500;
          -webkit-text-fill-color: #111827 !important;
        ">${startPoint.type === 'location' ? ((startPoint.data.mlt_speed || 0) * 3.6).toFixed(1) : 0} km/h</span></p></div><div style="margin-bottom: 0;"><p style="
          margin: 0; 
          font-size: 11px; 
          color: #9ca3af !important;
          -webkit-text-fill-color: #9ca3af !important;
        ">🌍 좌표: ${startPoint.lat ? startPoint.lat.toFixed(6) : '0.000000'}, ${startPoint.lng ? startPoint.lng.toFixed(6) : '0.000000'}</p></div></div>`,
        borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: new window.naver.maps.Point(0, -10)
      });
      window.naver.maps.Event.addListener(startIcon, 'click', () => { if (startInfoWindow.getMap()) { startInfoWindow.close(); } else { startInfoWindow.open(mapInstance, startIcon); } });
      startEndMarkers.current.push(startIcon);

      // 종료점 마커 (빨간색 원형 마커) - 시작점과 다른 경우에만
      if (sortedTimePoints.length > 1) {
        const endPosition = new window.naver.maps.LatLng(endPoint.lat, endPoint.lng);
        const endIcon = new window.naver.maps.Marker({ position: endPosition, map: mapInstance, icon: { content: `<div style="width: 20px; height: 20px; background: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; color: white;">E</div>`, anchor: new window.naver.maps.Point(13, 13) }, zIndex: 300 });

        // 종료점 InfoWindow (모바일 Safari 호환성 강화)
        const endInfoWindow = new window.naver.maps.InfoWindow({
          content: `<style>
            @keyframes slideInFromBottom { 
              0% { opacity: 0; transform: translateY(20px) scale(0.95); } 
              100% { opacity: 1; transform: translateY(0) scale(1); }
            } 
            .info-window-container { 
              animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
              -webkit-text-size-adjust: 100% !important;
              -webkit-font-smoothing: antialiased;
            } 
            .close-button { transition: all 0.2s ease; } 
            .close-button:hover { background: rgba(0, 0, 0, 0.2) !important; transform: scale(1.1); }
            /* 모바일 Safari 텍스트 색상 강제 설정 */
            .info-window-container * {
              color-scheme: light !important;
              -webkit-text-fill-color: initial !important;
            }
          </style><div class="info-window-container" style="
            padding: 12px 16px; 
            min-width: 200px; 
            max-width: 280px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: white !important; 
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
            position: relative;
            color-scheme: light !important;
          "><button class="close-button" onclick="this.parentElement.parentElement.style.display='none'; event.stopPropagation();" style="
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
            color: #666 !important;
            -webkit-text-fill-color: #666 !important;
          ">×</button><h3 style="
            margin: 0 0 8px 0; 
            font-size: 14px; 
            font-weight: 600; 
            color: #ef4444 !important; 
            padding-right: 25px; 
            text-align: center;
            -webkit-text-fill-color: #ef4444 !important;
          ">🏁 종료 지점</h3><div style="margin-bottom: 6px;"><p style="
            margin: 0; 
            font-size: 12px; 
            color: #64748b !important;
            -webkit-text-fill-color: #64748b !important;
          ">🕒 시간: <span style="
            color: #111827 !important; 
            font-weight: 500;
            -webkit-text-fill-color: #111827 !important;
          ">${endPoint.time ? endPoint.time.split(' ')[1] || endPoint.time : '정보 없음'}</span></p></div><div style="margin-bottom: 6px;"><p style="
            margin: 0; 
            font-size: 12px; 
            color: #64748b !important;
            -webkit-text-fill-color: #64748b !important;
          ">🚶 속도: <span style="
            color: #111827 !important; 
            font-weight: 500;
            -webkit-text-fill-color: #111827 !important;
          ">${endPoint.type === 'location' ? ((endPoint.data.mlt_speed || 0) * 3.6).toFixed(1) : 0} km/h</span></p></div><div style="margin-bottom: 0;"><p style="
            margin: 0; 
            font-size: 11px; 
            color: #9ca3af !important;
            -webkit-text-fill-color: #9ca3af !important;
          ">🌍 좌표: ${endPoint.lat ? endPoint.lat.toFixed(6) : '0.000000'}, ${endPoint.lng ? endPoint.lng.toFixed(6) : '0.000000'}</p></div></div>`,
          borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: new window.naver.maps.Point(0, -10)
        });
        window.naver.maps.Event.addListener(endIcon, 'click', () => { if (endInfoWindow.getMap()) { endInfoWindow.close(); } else { endInfoWindow.open(mapInstance, endIcon); } });
        startEndMarkers.current.push(endIcon);
      }
      console.log('[renderLocationDataOnMap] 시작/종료 마커 생성 완료');
    }

    // 5. 체류시간 마커 생성
    console.log('[renderLocationDataOnMap] 체류시간 마커 생성 시작');
    stayTimeMarkers.current = []; // 기존 체류시간 마커 초기화
    if (stayTimesData.length > 0) {
      // 체류시간에 따른 마커 크기와 색상 결정 함수
      const getMarkerStyle = (duration: number) => {
        let size = 30; // 기본 크기
        let bgColor = '#f59e0b'; // 기본 주황색
        let textColor = 'white';
        if (duration >= 300) { size = 40; bgColor = '#dc2626'; } else if (duration >= 120) { size = 36; bgColor = '#ea580c'; } else if (duration >= 60) { size = 32; bgColor = '#f59e0b'; } else if (duration >= 30) { size = 28; bgColor = '#eab308'; } else { size = 26; bgColor = '#22c55e'; }
        return { size, bgColor, textColor };
      };
      // 체류시간 포맷 함수
      const formatDuration = (minutes: number): string => { if (isNaN(minutes) || !isFinite(minutes) || minutes < 0) return '정보 없음'; const hours = Math.floor(minutes / 60); const mins = Math.floor(minutes % 60); if (hours > 0) return `${hours}시간 ${mins}분`; else return `${mins}분`; };

      // 시작점/종료점과 겹치지 않는 체류지점만 필터링
      const startEndPoints = sortedTimePoints.length > 0 ? { start: sortedTimePoints[0], end: sortedTimePoints[sortedTimePoints.length - 1] } : undefined;
      const isOverlapping = (stayPoint: StayTime, comparePoint: any): boolean => { if (!comparePoint) return false; const lat1 = stayPoint.latitude || stayPoint.start_lat || 0; const lng1 = stayPoint.longitude || stayPoint.start_long || 0; const lat2 = comparePoint.lat || 0; const lng2 = comparePoint.lng || 0; const threshold = 0.0001; return Math.abs(lat1 - lat2) < threshold && Math.abs(lng1 - lng2) < threshold; };
      const filteredStayTimes = [...stayTimesData].filter(stayPoint => { const overlapWithStart = startEndPoints?.start && isOverlapping(stayPoint, startEndPoints.start); const overlapWithEnd = startEndPoints?.end && isOverlapping(stayPoint, startEndPoints.end); return !(overlapWithStart || overlapWithEnd); });

      filteredStayTimes.forEach((stayData, index) => {
        const lat = stayData.latitude || stayData.start_lat; const lng = stayData.longitude || stayData.start_long; if (!lat || !lng || lat === 0 || lng === 0) return;
        const position = new window.naver.maps.LatLng(Number(lat), Number(lng));
        let durationMinutes = 0;
        if (typeof stayData.duration === 'number' && !isNaN(stayData.duration)) durationMinutes = stayData.duration;
        else if (stayData.stay_duration && typeof stayData.stay_duration === 'string') { const timeParts = stayData.stay_duration.split(':'); if (timeParts.length >= 2) { if (timeParts.length === 3) { const hours = parseInt(timeParts[0]) || 0; const minutes = parseInt(timeParts[1]) || 0; const seconds = parseFloat(timeParts[2]) || 0; durationMinutes = hours * 60 + minutes + seconds / 60; } else if (timeParts.length === 2) { const minutes = parseInt(timeParts[0]) || 0; const seconds = parseFloat(timeParts[1]) || 0; durationMinutes = minutes + seconds / 60; } } }
        const markerStyle = getMarkerStyle(durationMinutes); const markerNumber = index + 1;
        const marker = new window.naver.maps.Marker({ position: position, map: mapInstance, icon: { content: `<div style="position: relative; width: ${markerStyle.size}px; height: ${markerStyle.size}px; background: ${markerStyle.bgColor}; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${markerStyle.size > 32 ? '14px' : '12px'}; color: ${markerStyle.textColor};">${markerNumber}<div style="position: absolute; top: -20px; right: -20px; background: #1f2937; color: white; border-radius: 8px; padding: 2px 4px; font-size: 10px; font-weight: normal; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${formatDuration(durationMinutes)}</div></div>`, anchor: new window.naver.maps.Point(markerStyle.size / 2, markerStyle.size / 2) }, zIndex: 200 + index });
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `<style>
                @keyframes slideInFromBottom { 
                  0% { opacity: 0; transform: translateY(20px) scale(0.95); } 
                  100% { opacity: 1; transform: translateY(0) scale(1); }
                } 
                .info-window-container { 
                  animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                  -webkit-text-size-adjust: 100% !important;
                  -webkit-font-smoothing: antialiased;
                } 
                .close-button { transition: all 0.2s ease; } 
                .close-button:hover { background: rgba(0, 0, 0, 0.2) !important; transform: scale(1.1); }
                /* 모바일 Safari 텍스트 색상 강제 설정 */
                .info-window-container * {
                  color-scheme: light !important;
                  -webkit-text-fill-color: initial !important;
                }
              </style><div class="info-window-container" style="
                padding: 12px 16px; 
                min-width: 200px; 
                max-width: 280px; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                background: white !important; 
                border-radius: 12px; 
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
                position: relative;
                color-scheme: light !important;
              "><button class="close-button" onclick="this.parentElement.parentElement.style.display='none'; event.stopPropagation();" style="
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
                color: #666 !important;
                -webkit-text-fill-color: #666 !important;
              ">×</button><h3 style="
                margin: 0 0 8px 0; 
                font-size: 14px; 
                font-weight: 600; 
                color: #111827 !important; 
                padding-right: 25px; 
                text-align: center;
                -webkit-text-fill-color: #111827 !important;
              ">🏠 체류 지점 #${markerNumber}</h3><div style="margin-bottom: 6px;"><p style="
                margin: 0; 
                font-size: 12px; 
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
              ">🕐 시작: <span style="
                color: #111827 !important; 
                font-weight: 500;
                -webkit-text-fill-color: #111827 !important;
              ">${stayData.start_time.split(' ')[1]}</span></p></div><div style="margin-bottom: 6px;"><p style="
                margin: 0; 
                font-size: 12px; 
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
              ">🕐 종료: <span style="
                color: #111827 !important; 
                font-weight: 500;
                -webkit-text-fill-color: #111827 !important;
              ">${stayData.end_time.split(' ')[1]}</span></p></div><div style="margin-bottom: 0;"><p style="
                margin: 0; 
                font-size: 12px; 
                color: #64748b !important;
                -webkit-text-fill-color: #64748b !important;
              ">⏱️ 체류시간: <span style="
                color: ${markerStyle.bgColor} !important; 
                font-weight: bold; 
                background: ${markerStyle.bgColor}20; 
                padding: 4px 8px; 
                border-radius: 8px;
                -webkit-text-fill-color: ${markerStyle.bgColor} !important;
              ">${formatDuration(durationMinutes)}</span></p></div></div>`,
          borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: new window.naver.maps.Point(0, -10)
        });
        window.naver.maps.Event.addListener(marker, 'click', () => { if (infoWindow.getMap()) { infoWindow.close(); } else { infoWindow.open(mapInstance, marker); } });
        stayTimeMarkers.current.push(marker);
      });
    }
    console.log('[renderLocationDataOnMap] 체류시간 마커 생성 완료:', stayTimeMarkers.current.length, '개');

    // 6. 위치 로그 마커들 생성
    console.log('[renderLocationDataOnMap] 위치 로그 마커 생성 시작:', sortedLocationMarkers.length, '개');
    locationLogMarkers.current = []; // 기존 위치 로그 마커 초기화

    if (sortedLocationMarkers.length === 0) {
      console.warn('[renderLocationDataOnMap] 위치 로그 마커 데이터가 없음');
    }

    sortedLocationMarkers.forEach((markerData, index) => {
      try {
        const lat = markerData.latitude || markerData.mlt_lat || 0;
        const lng = markerData.longitude || markerData.mlt_long || 0;

        // 유효한 좌표인지 확인
        if (!lat || !lng || lat === 0 || lng === 0) {
          console.warn(`[renderLocationDataOnMap] 마커 ${index}: 유효하지 않은 좌표 (${lat}, ${lng})`);
          return;
        }

        const speedMs = markerData.speed || markerData.mlt_speed || 0;
        const speed = speedMs * 3.6;
        const accuracy = markerData.accuracy || markerData.mlt_accuacy || 0;
        const battery = markerData.battery_level || markerData.mlt_battery || 0;
        const timestamp = markerData.timestamp || markerData.mlt_gps_time || '정보 없음';
        const timeOnly = timestamp === '정보 없음' ? '정보 없음' : timestamp.includes('T') ? timestamp.split('T')[1]?.substring(0, 8) || timestamp : timestamp.includes(' ') ? timestamp.split(' ')[1] || timestamp : timestamp;

        const position = new window.naver.maps.LatLng(Number(lat), Number(lng));
        let markerColor = '#3b82f6'; // 기본 파란색
        if (speed > 5) markerColor = '#ef4444'; else if (speed > 2) markerColor = '#f59e0b'; else if (speed > 0.5) markerColor = '#10b981';

        if (index < 5) { // 처음 5개 마커만 상세 로깅
          console.log(`[renderLocationDataOnMap] 마커 ${index} 생성:`, {
            lat, lng, speed: speed.toFixed(1), timestamp: timeOnly
          });
        }

        // 속도에 따른 이동 수단 아이콘 결정
        const getTransportIcon = (speed: number) => {
          if (speed >= 30) return '🚗'; // 30km/h 이상: 자동차
          else if (speed >= 15) return '🏃'; // 15-30km/h: 달리기/자전거
          else if (speed >= 3) return '🚶'; // 3-15km/h: 걷기
          else if (speed >= 1) return '🧍'; // 1-3km/h: 천천히 걷기
          else return '⏸️'; // 1km/h 미만: 정지
        };

        const getTransportText = (speed: number) => {
          if (speed >= 30) return '차량 이동';
          else if (speed >= 15) return '빠른 이동';
          else if (speed >= 3) return '걷기';
          else if (speed >= 1) return '천천히 이동';
          else return '정지 상태';
        };

        const transportIcon = getTransportIcon(speed);
        const transportText = getTransportText(speed);

        const marker = new window.naver.maps.Marker({
          position: position,
          map: mapInstance,
          icon: {
            content: `<div style="width: 8px; height: 8px; background: ${markerColor}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
            anchor: new window.naver.maps.Point(6, 6)
          },
          zIndex: 100 + index
        });

        const infoWindow = new window.naver.maps.InfoWindow({
          content: `<style>
              /* 모바일 Safari 텍스트 색상 강제 설정 */
              .location-log-info * {
                color-scheme: light !important;
                -webkit-text-fill-color: initial !important;
                -webkit-text-size-adjust: 100% !important;
              }
            </style><div class="location-log-info" style="
              padding: 8px; 
              background: white !important; 
              border-radius: 6px; 
              box-shadow: 0 2px 8px rgba(0,0,0,0.12); 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              min-width: 140px; 
              max-width: 160px;
              color-scheme: light !important;
            "><div style="
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
              color: white !important; 
              padding: 4px 6px; 
              border-radius: 4px; 
              margin: -8px -8px 6px -8px; 
              font-weight: 600; 
              font-size: 11px; 
              text-align: center;
              -webkit-text-fill-color: white !important;
            ">${index + 1} / ${sortedLocationMarkers.length}</div><div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px;"><div style="display: flex; justify-content: space-between; align-items: center; background: rgba(59, 130, 246, 0.1); padding: 2px 4px; border-radius: 4px; margin: 2px 0;"><span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">이동 수단:</span><span style="font-weight: 600; font-size: 11px; display: flex; align-items: center; gap: 2px;">${transportIcon} <span style="font-size: 9px; color: #3b82f6 !important; -webkit-text-fill-color: #3b82f6 !important;">${transportText}</span></span></div><div style="display: flex; justify-content: space-between;"><span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">⏰ 시간:</span><span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${timeOnly}</span></div><div style="display: flex; justify-content: space-between; align-items: center;"><span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">🚀 속도:</span><span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${speed.toFixed(1)}km/h</span></div><div style="display: flex; justify-content: space-between;"><span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">📍 정확도:</span><span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${accuracy.toFixed(0)}m</span></div><div style="display: flex; justify-content: space-between;"><span style="color: #666 !important; -webkit-text-fill-color: #666 !important;">🔋 배터리:</span><span style="font-weight: 600; font-size: 10px; color: #111827 !important; -webkit-text-fill-color: #111827 !important;">${battery}%</span></div></div></div>`,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
          anchorSize: new window.naver.maps.Size(0, 0),
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infoWindow.getMap()) {
            infoWindow.close();
          } else {
            infoWindow.open(mapInstance, marker);
          }
        });

        locationLogMarkers.current.push(marker);
      } catch (markerError) {
        console.error(`[renderLocationDataOnMap] 마커 ${index} 생성 오류:`, markerError);
      }
    });
    console.log('[renderLocationDataOnMap] 위치 로그 마커 생성 완료:', locationLogMarkers.current.length, '개');

    // 7. 무지개 그라데이션 경로(Polyline) 생성
    console.log('[renderLocationDataOnMap] 무지개 그라데이션 경로 및 화살표 생성 시작');
    if (locationLogPolyline.current) { // 혹시 남아있는 이전 경로 정리
      try { locationLogPolyline.current.setMap(null); } catch (e) { console.error('[renderLocationDataOnMap] Error setting old polyline map to null:', e); }
      locationLogPolyline.current = null;
    }

    // 기존 그라데이션 경로들 정리
    if (window.gradientPolylines) {
      window.gradientPolylines.forEach((polyline: any) => {
        try { polyline.setMap(null); } catch (e) { console.error('Error removing gradient polyline:', e); }
      });
    }
    window.gradientPolylines = [];

    if (sortedTimePoints.length > 1) {
      const pathCoordinates = sortedTimePoints.map(point => new window.naver.maps.LatLng(point.lat, point.lng));

      // 글로시 무지개 색상 배열 (빨주노초파남보)
      const rainbowColors = [
        '#FF6B6B', // 글로시 빨강
        '#FF9F43', // 글로시 주황  
        '#FFC947', // 글로시 노랑
        '#54D62C', // 글로시 연두
        '#00C9FF', // 글로시 하늘색
        '#7B68EE', // 글로시 라벤더
        '#FF6EC7', // 글로시 핑크
        '#FF8A80', // 글로시 코랄
        '#69F0AE', // 글로시 민트
        '#40C4FF', // 글로시 블루
        '#B388FF', // 글로시 퍼플
      ];

      // 각 구간마다 다른 색상의 폴리라인 생성 (청크 단위 최적화)
      const CHUNK_SIZE = 20; // 20개 포인트를 하나의 청크로 묶음

      for (let i = 0; i < pathCoordinates.length - 1; i += CHUNK_SIZE) {
        // 청크의 끝 인덱스 계산 (배열 범위를 넘지 않도록)
        const endIndex = Math.min(i + CHUNK_SIZE, pathCoordinates.length - 1);

        // 청크가 유효하려면 최소 2개 이상의 포인트가 있어야 함
        if (endIndex <= i) continue;

        // 청크의 시작점 기준으로 진행률 계산 및 색상 결정
        const progress = i / (pathCoordinates.length - 1);
        const colorIndex = Math.floor(progress * (rainbowColors.length - 1));
        const nextColorIndex = Math.min(colorIndex + 1, rainbowColors.length - 1);
        const segmentProgress = (progress * (rainbowColors.length - 1)) - colorIndex;

        // 두 색상 간 보간
        const color1 = rainbowColors[colorIndex];
        const color2 = rainbowColors[nextColorIndex];
        const interpolatedColor = interpolateColor(color1, color2, segmentProgress);

        // 청크에 포함될 좌표들 추출
        // Array.slice는 endIndex를 포함하지 않으므로 +1 해줘야 함, 
        // 그리고 다음 청크와 연결되게 하기 위해 endIndex 포인트도 포함해야 함
        const chunkPath = pathCoordinates.slice(i, endIndex + 1);

        const segmentPolyline = new window.naver.maps.Polyline({
          map: mapInstance,
          path: chunkPath,
          strokeColor: interpolatedColor,
          strokeOpacity: 0.85,
          strokeWeight: 5,
          strokeStyle: 'solid',
          startIcon: i === 0 ? window.naver.maps.PointingIcon.CIRCLE : undefined, // 시작점 장식 (선택)
          startIconSize: i === 0 ? 5 : undefined,
          endIcon: endIndex === pathCoordinates.length - 1 ? window.naver.maps.PointingIcon.OPEN_ARROW : undefined, // 끝점 화살표 (선택)
          endIconSize: endIndex === pathCoordinates.length - 1 ? 5 : undefined
        });

        window.gradientPolylines.push(segmentPolyline);
      }

      // 방향 화살표 추가 (3개 지점마다)
      for (let i = 0; i < sortedTimePoints.length - 1; i += 3) {
        const currentPoint = sortedTimePoints[i];
        const nextPoint = sortedTimePoints[i + 1];
        const midLat = (currentPoint.lat + nextPoint.lat) / 2;
        const midLng = (currentPoint.lng + nextPoint.lng) / 2;
        const deltaLat = nextPoint.lat - currentPoint.lat;
        const deltaLng = nextPoint.lng - currentPoint.lng;
        const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);

        // 화살표 색상도 해당 위치의 무지개 색상으로
        const progress = i / (sortedTimePoints.length - 1);
        const colorIndex = Math.floor(progress * (rainbowColors.length - 1));
        const arrowColor = rainbowColors[colorIndex];

        const arrowMarker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(midLat, midLng),
          map: mapInstance,
          icon: {
            content: `<div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 10px solid ${arrowColor}; border-top: none; transform: rotate(${angle}deg); transform-origin: center center; opacity: 0.9; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));"></div>`,
            anchor: new window.naver.maps.Point(5, 5)
          },
          zIndex: 50
        });
        arrowMarkers.current.push(arrowMarker);
      }
    }
    console.log('[renderLocationDataOnMap] 무지개 그라데이션 경로 연결선 및 화살표 생성 완료');

    // 8. 지도 렌더링 완료 후 시작위치로 중심 재설정
    console.log('[renderLocationDataOnMap] 지도 렌더링 완료 - 시작위치로 중심 재설정');

    // 시작위치로 지도 중심 재설정 (마커 생성 후 확실히 적용)
    if (locationMarkersData.length > 0 && mapCenter) {
      setTimeout(() => {
        if (map.current && mapCenter) {
          map.current.setCenter(mapCenter);
          map.current.setZoom(16);
          console.log('[renderLocationDataOnMap] 시작위치로 지도 중심 재설정 완료');
        }
      }, 100);
    }

    // 9. 지도 새로고침 (마커 렌더링 완료 후 한 번만)
    setTimeout(() => {
      if (map.current) {
        map.current.refresh(true);
        console.log('[renderLocationDataOnMap] 최종 지도 새로고침 완료');
      }
    }, 200);

    console.log('[renderLocationDataOnMap] 통합 지도 렌더링 완료');

    // 🎯 슬라이더를 항상 시작점(0%)으로 리셋 
    setTimeout(() => {
      setSliderValue(0);
      setIsSliderDragging(false);
      console.log('[renderLocationDataOnMap] 슬라이더를 시작점(0%)으로 리셋 완료');
    }, 100);
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>

      {/* 초기 로딩 오버레이 */}
      <InitialLoadingOverlay
        isVisible={isInitialLoading}
        loadingStep={loadingStep}
        progress={loadingProgress}
        hasFailed={hasInitialLoadFailed}
        onRetry={handleInitialLoadingRetry}
        onSkip={handleInitialLoadingSkip}
      />

      {/* 메인 컨테이너 - 고정 레이아웃 */}
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        className="fixed inset-0 overflow-hidden hardware-accelerated"
        id="activelog-page-container"
        style={{
          background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
          paddingTop: '0px',
          marginTop: '0px',
          top: '0px'
        }}
      >
        {/* 통일된 헤더 애니메이션 */}
        <motion.div
          className="header-fixed glass-effect activelog-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            paddingTop: 0,
            marginTop: 0,
            height: '62px',
          }}
        >
          <div className="flex items-center justify-between h-[62px] px-4">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex items-center space-x-3 motion-div"
            >
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">활동 로그</h1>
                  <p className="text-xs text-gray-500">그룹 멤버들의 활동 기록을 확인해보세요</p>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center space-x-2">
              {/* 필요시 추가 버튼들을 여기에 배치 */}
            </div>
          </div>
        </motion.div>

        {/* 지도 영역 - 고정 위치 */}
        <motion.div
          variants={mapContainerVariants}
          initial="initial"
          animate="animate"
          className="absolute inset-0 hardware-accelerated safe-area-all"
          style={{
            top: '0px', // 헤더 패딩 제거
            bottom: '0px', // 네비게이션 바 아래 패딩 제거
            left: '0',
            right: '0',
            zIndex: 1 // 헤더보다 낮은 z-index
          }}
        >
          {/* 스켈레톤 UI - 지도 로딩 중이거나 멤버 데이터 대기 중일 때 표시 */}
          {(isMapLoading || isWaitingForMembers) && (
            <div className="absolute top-0 left-0 w-full h-full z-5">
              <MapSkeleton
                showControls={true}
                showMemberList={false}
                className="w-full h-full"
              />
            </div>
          )}

          <div ref={mapContainer} className="w-full h-full logs-map-container z-map" />

          {/* 커스텀 줌 컨트롤 */}
          {map.current && (
            <div
              className="absolute right-[10px] z-30 z-zoom-control flex flex-col"
              style={{
                top: '150px'
              }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (map.current) {
                    const currentZoom = map.current.getZoom();
                    map.current.setZoom(currentZoom + 1);
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
                  if (map.current) {
                    const currentZoom = map.current.getZoom();
                    map.current.setZoom(currentZoom - 1);
                  }
                }}
                className="w-10 h-10 bg-white border border-gray-300 rounded-b-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold">−</span>
              </motion.button>
            </div>
          )}

          {/* 새로운 플로팅 통합 정보 카드 */}
          <AnimatePresence>
            {groupMembers.some(m => m.isSelected) && selectedDate && (
              <motion.div
                variants={floatingCardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute left-0 right-0 z-40 z-floating-card flex justify-center px-4"
                style={{ top: '68px', left: '20px', right: '20px' }}
              >
                <motion.div
                  whileHover={{
                    scale: 1.03,
                    y: -3,
                    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)"
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsSidebarOpen(true)}
                  className="bg-white rounded-2xl px-3 pt-4 shadow-2xl border border-gray-100 cursor-pointer relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)',
                    backdropFilter: 'blur(20px)',
                    width: 'auto',
                    minWidth: '380px'
                  }}
                >
                  {/* 배경 장식 */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full -translate-y-12 translate-x-12 opacity-60"></div>

                  <div className="relative flex items-center space-x-4">
                    {/* 멤버 프로필 영역 */}
                    <div className="flex items-center space-x-3 pb-1">
                      <div className="relative">
                        <div className="w-9 h-9 mb-2 rounded-full overflow-hidden ring-2 ring-white shadow bg-gradient-to-br from-gray-100 to-gray-200">
                          <Image
                            src={(() => {
                              const member = groupMembers.find(m => m.isSelected);
                              return member ? getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index) : '';
                            })()}
                            alt={groupMembers.find(m => m.isSelected)?.name || ''}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            priority={true}
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              const member = groupMembers.find(m => m.isSelected);
                              if (member) {
                                const fallbackUrl = getDefaultImage(member.mt_gender, member.original_index);
                                if (img.src !== fallbackUrl) {
                                  img.src = fallbackUrl;
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full shadow-md"></div>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm font-bold text-gray-900">
                            {groupMembers.find(m => m.isSelected)?.name}
                          </span>
                          <span className="text-xs text-gray-400">의 기록</span>
                        </div>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className="text-xs font-medium text-blue-500" style={{ minWidth: '85px' }}>
                            {format(new Date(selectedDate), 'MM월 dd일 (E)', { locale: ko })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 구분선 */}
                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-200 to-transparent"></div>

                    {/* 통계 영역 2단 구조 */}
                    {(isLocationDataLoading || isDailyCountsLoading || isMemberActivityLoading) ? (
                      <div className="flex items-center justify-center py-2 px-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <FiLoader className="w-4 h-4 text-blue-500" />
                        </motion.div>
                        <span className="ml-2 text-xs text-gray-500">로딩 중...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col items-center justify-center" style={{ minWidth: '50px' }}>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center mb-0.5">
                            <FiTrendingUp className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap" style={{ minWidth: '50px', textAlign: 'center' }}>
                            {locationSummary.distance}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center" style={{ minWidth: '45px' }}>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mb-0.5">
                            <FiClock className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap" style={{ minWidth: '45px', textAlign: 'center' }}>
                            {locationSummary.time}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center" style={{ minWidth: '55px' }}>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center mb-0.5">
                            <FiZap className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap" style={{ minWidth: '55px', textAlign: 'center' }}>
                            {locationSummary.steps}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* 새로운 경로따라가기 섹션 */}
          <AnimatePresence>
            {groupMembers.some(m => m.isSelected) && selectedDate && sortedLocationData.length > 0 && (
              <div
                className="activelog-control-buttons"
                style={{
                  position: 'fixed',
                  bottom: '70px',
                  left: '16px',
                  zIndex: 9989
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-white/95 backdrop-blur-sm rounded-2xl px-3 py-2 shadow-lg border border-white/30 w-[210px]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {/* 헤더 섹션 */}
                  <div className="flex items-center justify-start space-x-2 py-1">
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <FiPlayCircle className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">경로 따라가기</h3>
                  </div>

                  {/* 슬라이더 컨트롤 영역 */}
                  <div className="px-3 pt-2 pb-1">
                    <div
                      ref={sliderRef}
                      className="relative w-full h-6 cursor-pointer select-none touch-none"
                      style={{
                        touchAction: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none'
                      }}
                      onMouseDown={handleSliderStart}
                      onTouchStart={handleSliderStart}
                    >
                      {/* 트랙 배경 */}
                      <div
                        className="absolute w-full h-2 bg-gray-200 rounded-full"
                        style={{
                          top: '50%',
                          left: '0',
                          transform: 'translateY(-50%)',
                          zIndex: 1,
                        }}
                      />

                      {/* 진행바 */}
                      <div
                        className={`absolute h-2 rounded-full ${isSliderDragging ? '' : 'transition-all duration-200 ease-out'
                          }`}
                        style={{
                          top: '50%',
                          left: '0',
                          width: `${sliderValue}%`,
                          transform: 'translateY(-50%)',
                          maxWidth: '100%',
                          backgroundColor: '#2C6BEE',
                          zIndex: 2,
                        }}
                      />

                      {/* 핸들 */}
                      <div
                        className={`absolute w-5 h-5 border-2 rounded-full shadow-lg cursor-grab active:cursor-grabbing ${isSliderDragging ? 'scale-125' : 'transition-all duration-200 ease-out hover:scale-110'
                          }`}
                        style={{
                          top: '50%',
                          left: `calc(${sliderValue}% + 5px)`,
                          transform: 'translate(calc(-50% - 5px), -50%)',
                          backgroundColor: '#2C6BEE',
                          borderColor: '#2C6BEE',
                          zIndex: 10,
                        }}
                      >
                        {/* 핸들 내부 점 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* 슬라이더 레이블 및 정보 */}
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2 h-6">
                      <div className="flex items-center justify-center h-full">
                        <span className="text-xs">시작</span>
                      </div>
                      <div className="flex items-center justify-center px-2 py-1 rounded-full h-full" style={{ backgroundColor: 'rgba(1, 19, 163, 0.1)' }}>
                        <span className="font-semibold text-xs" style={{ color: '#2C6BEE' }}>{Math.round(sliderValue)}%</span>
                      </div>
                      <div className="flex items-center justify-center h-full">
                        <span className="text-xs">종료</span>
                      </div>
                    </div>
                  </div>

                  {/* 추가 정보 섹션 */}
                  {/* <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-gray-600">탐색 완료</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                          <span className="text-gray-600">미탐색 구간</span>
                        </div>
                      </div>
                      <div className="text-gray-500">
                        {isSliderDragging ? '🎯 경로 탐색 중...' : '👆 핸들을 드래그하여 경로 탐색'}
                      </div>
                    </div>
                  </div> */}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </motion.div>


      </motion.div>

      {/* 플로팅 사이드바 토글 버튼 */}
      {/* 사이드바 오버레이 */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            variants={sidebarOverlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[사이드바] 오버레이 클릭으로 닫기');
              // 드롭다운이 열려있으면 사이드바를 닫지 않음
              if (isGroupSelectorOpen) {
                console.log('[사이드바] 드롭다운이 열려있어서 사이드바 닫기 취소');
                return;
              }

              // 닫기 상태 설정하여 중복 처리 방지
              sidebarClosingRef.current = true;

              // 사이드바 닫기
              setIsSidebarOpen(false);

              // 일정 시간 후 닫기 상태 해제
              setTimeout(() => {
                sidebarClosingRef.current = false;
              }, 500);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.preventDefault()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{
              // 모바일 사파리 최적화
              transform: 'translateZ(0)',
              willChange: 'opacity',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
          />
        )}
      </AnimatePresence>

      {/* 플로팅 사이드바 토글 버튼 */}
      <FloatingButton
        variant="activelog"
        onClick={toggleSidebar}
        isOpen={isSidebarOpen}
        badgeCount={groupMembers.length}
        style={{
          bottom: '90px',
          right: '16px',
          zIndex: 99999
        }}
      />

      {/* 사이드바 */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            ref={sidebarRef}
            variants={sidebarVariants}
            initial={isSidebarOpen ? "open" : "closed"}
            animate="open"
            exit="closed"
            className="fixed left-0 top-0 w-72 shadow-2xl border-r z-[9999] flex flex-col"
            style={{
              background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
              borderColor: 'rgba(1, 19, 163, 0.1)',
              top: '0px',
              bottom: '0px',
              height: '100vh',
              maxHeight: '100vh',
              position: 'fixed',
              borderRadius: '0 18px 18px 0',
              boxShadow: '0 8px 32px rgba(31,41,55,0.18), 0 1.5px 6px rgba(0,0,0,0.08)',
              // 모바일 사파리 최적화
              transform: 'translateZ(0)',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              WebkitPerspective: 1000,
              WebkitTransform: 'translateZ(0)'
            }}
            // 사이드바 터치 이벤트 최적화 - 스크롤 방해 방지
            onTouchStart={(e) => {
              // 사이드바 내부 터치만 처리
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              // 스크롤을 방해하지 않도록 기본 동작 허용
              // e.stopPropagation() 제거하여 스크롤이 자연스럽게 작동하도록 함
            }}
            onTouchEnd={(e) => {
              // 사이드바 내부 터치만 처리
              e.stopPropagation();
            }}
          >
            <motion.div
              variants={sidebarContentVariants}
              initial={isSidebarOpen ? "open" : "closed"}
              animate="open"
              exit="closed"
              className="p-6 h-full flex flex-col relative z-10 overflow-hidden sidebar-content"
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <motion.div
                    className="p-2 rounded-xl shadow-lg"
                    style={{ backgroundColor: '#0113A3' }}
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
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[사이드바] X 버튼으로 닫기');

                    // 닫기 상태 설정하여 중복 처리 방지
                    sidebarClosingRef.current = true;

                    // 사이드바 닫기
                    setIsSidebarOpen(false);

                    // 일정 시간 후 닫기 상태 해제
                    setTimeout(() => {
                      sidebarClosingRef.current = false;
                    }, 500);
                  }}
                  className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 backdrop-blur-sm"
                  data-sidebar-close-button="true"
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

                {/* 그룹목록이 이미 로드되어 있으므로 Suspense 제거하고 즉시 렌더링 */}
                {isUserDataLoading || !userGroups || userGroups.length === 0 || !isGroupMemberCountsLoaded ? (
                  <div className="w-full px-4 pt-3 rounded-xl bg-white border border-gray-200 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded flex-1 mr-2"></div>
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ) : (
                  <GroupSelector
                    userGroups={userGroups}
                    selectedGroupId={selectedGroupId}
                    isGroupSelectorOpen={isGroupSelectorOpen}
                    isSidebarOpen={isSidebarOpen}
                    groupMemberCounts={groupMemberCounts}
                    onOpen={() => setIsGroupSelectorOpen(true)}
                    onClose={() => setIsGroupSelectorOpen(false)}
                    onGroupSelect={(groupId) => {
                      if (selectedGroupId !== groupId) {
                        handleGroupSelect(groupId);
                      }
                    }}
                  />
                )}
              </div>

              {/* 멤버 목록 */}
              <div className="flex-1 min-h-0">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                  <h3 className="text-base font-semibold text-gray-800">멤버 목록</h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/50 to-transparent"></div>
                  <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full backdrop-blur-sm">
                    {selectedGroupId && groupMemberCounts[selectedGroupId] !== undefined
                      ? `${groupMemberCounts[selectedGroupId]}명`
                      : groupMembers.length > 0
                        ? `${groupMembers.length}명`
                        : '로딩 중...'
                    }
                  </span>
                </div>
                <div
                  className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pb-4"
                  style={{
                    maxHeight: 'calc(100vh - 300px)',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth',
                    touchAction: 'pan-y',
                    overscrollBehavior: 'contain'
                  }}
                >
                  {groupMembers.length > 0 ? (
                    <motion.div
                      variants={sidebarContentVariants}
                      initial="closed"
                      animate="open"
                      className="space-y-2"
                    >
                      {sortGroupMembers(groupMembers).map((member, index) => (
                        <motion.div
                          key={member.id}
                          id={`member-${member.id}`}
                          variants={memberItemVariants}
                          onClick={(e) => {
                            console.log('[멤버 클릭] 멤버 선택:', member.name);
                            handleMemberSelect(member.id, e);
                            // 멤버 선택 시 사이드바는 자동으로 닫힘 (handleMemberSelect에서 처리)
                          }}
                          className={`p-4 rounded-xl cursor-pointer transition-colors duration-200 backdrop-blur-sm touch-optimized ${member.isSelected
                            ? 'border-2 shadow-lg'
                            : 'bg-white/60 hover:bg-white/90 border hover:shadow-md'
                            }`}
                          style={{
                            ...(member.isSelected
                              ? {
                                background: 'linear-gradient(to bottom right, rgba(240, 249, 255, 0.8), rgba(253, 244, 255, 0.8))',
                                borderColor: 'rgba(1, 19, 163, 0.3)',
                                boxShadow: '0 10px 25px rgba(1, 19, 163, 0.1)'
                              }
                              : {
                                borderColor: 'rgba(1, 19, 163, 0.1)'
                              }
                            )
                          }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <div
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
                              >
                                <Image
                                  src={getSafeImageUrl(member.mt_file1, member.mt_gender, member.original_index)}
                                  alt={member.name}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover member-image"
                                  placeholder="blur"
                                  priority={member.isSelected}
                                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Kic6LbqN1NzKhDFl3HI7L7IlJWK3jKYBaKJmVdJKhg1Qg8yKjfpYZaGu7WZPYwNAR4vTYK5AAAAABJRU5ErkJggg=="
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    const fallbackUrl = getDefaultImage(member.mt_gender, member.original_index);
                                    if (img.src !== fallbackUrl) {
                                      img.src = fallbackUrl;
                                    }
                                  }}
                                />
                              </div>

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
                                {/* 활동 로그 표시 */}
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs text-gray-500">📊</span>
                                  <span className={`text-xs font-normal ${member.isSelected ? 'text-gray-700' : 'text-gray-700'
                                    }`}>
                                    활동로그
                                  </span>
                                </div>
                              </div>

                              {/* 2주간 로그 분포 시각화 - 오늘 기준 2줄로 표현 */}
                              <div className="mt-2">
                                <div className="flex items-center space-x-1 mb-2">
                                  <span className="text-xs text-gray-400">2주간 활동</span>
                                  <div className="flex-1 h-px bg-gray-200"></div>
                                  <span className="text-xs text-gray-500">
                                    {(() => {
                                      const activeDays = (memberLogDistribution[member.id] || Array(14).fill(false)).filter(Boolean).length;
                                      return `${activeDays}/14일`;
                                    })()}
                                  </span>
                                </div>

                                {/* 요일 헤더 - 실제 날짜에 따른 동적 요일 */}
                                <div className="grid grid-cols-7 gap-1.5 mb-1">
                                  {Array.from({ length: 7 }, (_, index) => {
                                    // 윗줄(13~7일전)의 실제 요일 계산
                                    const offset = 13 - index;
                                    const date = new Date();
                                    date.setDate(date.getDate() - offset);
                                    const dayOfWeek = date.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
                                    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                                    const dayLabel = dayLabels[dayOfWeek];

                                    return (
                                      <div
                                        key={`day-header-${index}`}
                                        className={`h-3 rounded text-[9px] font-bold flex items-center justify-center
                                          ${dayOfWeek === 0 ? 'text-red-500 bg-red-50' :
                                            dayOfWeek === 6 ? 'text-blue-500 bg-blue-50' :
                                              'text-gray-500 bg-gray-50'}
                                        `}
                                      >
                                        {dayLabel}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* 14일 네모 캘린더 - 7x2 그리드로 개선 */}
                                <div className="grid grid-cols-7 gap-1.5 mb-1">
                                  {Array.from({ length: 14 }, (_, i) => {
                                    // 0~6: 13~7일전(윗줄), 7~13: 6~0일전(아랫줄)
                                    const row = i < 7 ? 0 : 1;
                                    const col = i % 7;
                                    const dayIndex = i;
                                    const arr = memberLogDistribution[member.id] || Array(14).fill(false);
                                    const hasLog = arr[dayIndex];
                                    // 0~6: 13~7일전, 7~13: 6~0일전
                                    const offset = row === 0 ? 13 - col : 6 - col;
                                    const date = new Date();
                                    date.setDate(date.getDate() - offset);
                                    const dateString = format(date, 'yyyy-MM-dd');
                                    const isSelected = dateString === selectedDate && member.isSelected;
                                    const isToday = offset === 0;
                                    return (
                                      <div
                                        key={`calendar-${i}`}
                                        className={`w-4 h-4 rounded transition-colors duration-200 flex items-center justify-center text-[10px] font-bold select-none
                                          ${isSelected
                                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 border border-pink-600 ring-2 ring-pink-300 shadow-md text-white'
                                            : hasLog
                                              ? 'bg-indigo-400/80 border border-indigo-500/30 cursor-pointer hover:bg-indigo-500/90 text-white'
                                              : 'bg-gray-50 border border-gray-200/50 text-gray-300'}
                                          ${isToday ? 'ring-2 ring-indigo-400' : ''}
                                        `}
                                        title={`${format(date, 'MM.dd(E)', { locale: ko })} - ${hasLog ? '활동 있음' : '활동 없음'}${isToday ? ' (오늘)' : ''}${isSelected ? ' (선택됨)' : hasLog ? ' (클릭하여 이동)' : ''}`}
                                        onClick={hasLog ? (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleCalendarSquareClick(member, dateString, e);
                                        } : undefined}
                                        style={{ marginBottom: row === 0 ? '2px' : 0 }}
                                      >
                                        {isToday ? '●' : ''}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex justify-between px-0.5 mt-0.5">
                                  <span className="text-[10px] text-gray-400">1주전</span>
                                  <span className="text-[10px] text-indigo-600 font-semibold">오늘</span>
                                </div>
                              </div>
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
        )}
      </AnimatePresence>

      {/* 에러 토스트 */}
      <ErrorToast
        error={dataError}
        onRetry={retryDataLoad}
        onDismiss={() => setDataError(null)}
        retryCount={retryCount}
        maxRetries={maxRetries}
        isLoading={isLocationDataLoading}
        autoHide={true}
        duration={7000}
      />

      {/* WebKit 환경 표시 (개발/디버깅용) */}
      {(isWebKitEnv || isIOSWebViewEnv) && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-2 left-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs border border-yellow-300 z-50">
          <div className="flex items-center space-x-1">
            <span>🕸️</span>
            <span>{isIOSWebViewEnv ? 'iOS WebView' : 'WebKit'}</span>
            <span className="text-yellow-600">최적화 적용</span>
          </div>
        </div>
      )}

      {/* <DebugPanel />
      <LogParser /> */}
    </>
  );
};