'use client';

// 🚨 iOS WebView Array.isArray 에러 방지 - 최우선 실행
if (typeof window !== 'undefined') {
  try {
    // Array 객체가 없거나 손상된 경우 즉시 복구
    if (typeof Array === 'undefined' || !Array || typeof Array.isArray !== 'function') {
      console.warn('[HOME] 🚨 Array.isArray 손상 감지 - 즉시 복구');
      
      // 전역 Array 객체 복구
      if (!window.Array) {
        (window as any).Array = function() {
          const arr = [];
          for (let i = 0; i < arguments.length; i++) {
            arr[i] = arguments[i];
          }
          return arr;
        };
      }
      
      // Array.isArray 메소드 복구
      if (!window.Array.isArray) {
        (window.Array as any).isArray = function(obj: any): obj is any[] {
          if (obj === null || obj === undefined) return false;
          try {
            return Object.prototype.toString.call(obj) === '[object Array]';
          } catch (e) {
            return !!(obj && typeof obj === 'object' && 
                     typeof obj.length === 'number' && 
                     typeof obj.push === 'function');
          }
        };
      }
      
      // 전역 범위에도 할당
      if (typeof globalThis !== 'undefined') {
        globalThis.Array = window.Array;
      }
      if (typeof global !== 'undefined') {
        global.Array = window.Array;
      }
    }
    
    // 추가 안전장치: 현재 스코프에서도 Array 확인
    if (typeof Array === 'undefined' || !Array) {
      window.Array = window.Array || Array || function() {
        const arr = [];
        for (let i = 0; i < arguments.length; i++) {
          arr[i] = arguments[i];
        }
        return arr;
      };
    }
    
    console.log('[HOME] ✅ Array.isArray 폴리필 적용 완료:', {
      hasArray: typeof Array !== 'undefined',
      hasIsArray: typeof Array !== 'undefined' && Array && typeof Array.isArray === 'function',
      testResult: typeof Array !== 'undefined' && Array && Array.isArray ? Array.isArray([1,2,3]) : 'N/A'
    });
    
  } catch (polyfillError) {
    console.error('[HOME] 🚨 Array.isArray 폴리필 적용 실패:', polyfillError);
  }
}

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import { useUser } from '@/contexts/UserContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { Loader } from '@googlemaps/js-api-loader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { MapSkeleton } from '@/components/common/MapSkeleton';
import { FiLoader, FiChevronDown, FiUser, FiCalendar } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import config, { API_KEYS, detectLanguage, MAP_CONFIG } from '../../config';
import mapService, { 
  MapType as MapTypeService, 
  MAP_API_KEYS, 
  Location, 
  cleanupGoogleMap, 
  cleanupNaverMap 
} from '../../services/mapService';
import { 
  detectEnvironment, 
  logEnvironmentInfo, 
  MapApiLoader,
  checkNetworkStatus,
  type EnvironmentConfig 
} from '../../utils/domainDetection';

import memberService from '@/services/memberService';
import scheduleService from '../../services/scheduleService';
import groupService from '@/services/groupService';
import { useAuth } from '@/contexts/AuthContext';
import authService from '@/services/authService';
import notificationService from '@/services/notificationService';
import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../../types/enums';
import { triggerHapticFeedback, HapticFeedbackType, hapticFeedback } from '@/utils/haptic';
import DebugPanel from '../components/layout/DebugPanel';
import LogParser from '../components/layout/LogParser';
import AnimatedHeader from '../../components/common/AnimatedHeader';
import GroupSelector from '@/components/location/GroupSelector';

declare global {
  interface Window {
    naver: any;
    google: any;
    webkit?: {
      messageHandlers?: {
        smapIos?: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

const GOOGLE_MAPS_API_KEY = MAP_API_KEYS.GOOGLE;
const NAVER_MAPS_CLIENT_ID = MAP_API_KEYS.NAVER_CLIENT_ID;

const BOTTOM_SHEET_POSITIONS = {
  COLLAPSED_HEIGHT: 100,
  MIDDLE_PERCENTAGE: 0.68,
  EXPANDED_PERCENTAGE: 0.15,
  TRANSITION_DURATION: '0.5s',
  TRANSITION_TIMING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  MIN_DRAG_DISTANCE: 80
};

const RECOMMENDED_PLACES = [
  { id: '1', title: '스타벅스 강남점', distance: 0.3, address: '서울시 강남구 역삼동 123-45', tel: '02-1234-5678', url: 'https://www.starbucks.co.kr' },
  { id: '2', title: '투썸플레이스 서초점', distance: 0.5, address: '서울시 서초구 서초동 456-78', tel: '02-2345-6789', url: 'https://www.twosome.co.kr' }
];

type MapType = MapTypeService;

interface GroupMember {
  id: string; name: string; photo: string | null; isSelected: boolean; location: Location;
  schedules: Schedule[]; mt_gender?: number | null; original_index: number;
  mlt_lat?: number | null; mlt_long?: number | null; mlt_speed?: number | null;
  mlt_battery?: number | null; mlt_gps_time?: string | null;
  sgdt_owner_chk?: string; sgdt_leader_chk?: string;
  sgdt_idx?: number; // 그룹 상세 인덱스 추가
}

interface Schedule {
  id: string; sst_pidx?: number | null; memberId?: string | null; mt_schedule_idx?: number | null;
  title?: string | null; date?: string | null; sst_edate?: string | null; sst_sedate?: string | null;
  sst_all_day?: AllDayCheckEnum | null; sst_repeat_json?: string | null; sst_repeat_json_v?: string | null;
  sgt_idx?: number | null; sgdt_idx?: number | null; sgdt_idx_t?: string | null;
  sst_alram?: number | null; sst_alram_t?: string | null; sst_adate?: string | null;
  slt_idx?: number | null; slt_idx_t?: string | null; location?: string | null;
  sst_location_add?: string | null; sst_location_lat?: number | null; sst_location_long?: number | null;
  sst_supplies?: string | null; sst_memo?: string | null; sst_show?: ShowEnum | null;
  sst_location_alarm?: number | null; sst_schedule_alarm_chk?: ScheduleAlarmCheckEnum | null;
  sst_pick_type?: string | null; sst_pick_result?: number | null; sst_schedule_alarm?: string | null;
  sst_update_chk?: string | null; sst_wdate?: string | null; sst_udate?: string | null;
  sst_ddate?: string | null; sst_in_chk?: InCheckEnum | null; sst_schedule_chk?: ScheduleCheckEnum | null;
  sst_entry_cnt?: number | null; sst_exit_cnt?: number | null;
  statusDetail?: { name: 'completed' | 'ongoing' | 'upcoming' | 'default'; text: string; color: string; bgColor: string; };
}

const googleMapsLoader = new Loader({
  apiKey: GOOGLE_MAPS_API_KEY, version: 'weekly', libraries: ['places'], id: 'google-maps-script'
});

const apiLoadStatus = { google: false, naver: false };

const mobileStyles = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  /* iOS 웹뷰 최적화 */
  -webkit-text-size-adjust: 100%;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* iOS 웹뷰 고정 헤더 최적화 */
.header-fixed {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  will-change: transform !important;
  transform: translateZ(0) !important;
  /* iOS Safari 상단 노치 대응 */
  padding-top: env(safe-area-inset-top, 0px);
  /* iOS 웹뷰에서 고정 요소 최적화 */
  -webkit-transform: translateZ(0);
  -webkit-perspective: 1000;
  -webkit-backface-visibility: hidden;
}

/* iOS 웹뷰 하단 네비게이션 최적화 */
.navigation-fixed {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  will-change: transform !important;
  transform: translateZ(0) !important;
  /* iOS Safari 하단 노치 대응 */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  /* iOS 웹뷰에서 고정 요소 최적화 */
  -webkit-transform: translateZ(0);
  -webkit-perspective: 1000;
  -webkit-backface-visibility: hidden;
}

/* iOS Safe Area 대응 */
.safe-area-padding-top {
  padding-top: env(safe-area-inset-top, 0px);
}

.safe-area-padding-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.safe-area-padding-left {
  padding-left: env(safe-area-inset-left, 0px);
}

.safe-area-padding-right {
  padding-right: env(safe-area-inset-right, 0px);
}

/* iOS 웹뷰 전용 viewport 최적화 */
@supports (-webkit-touch-callout: none) {
  .header-fixed {
    -webkit-position: sticky;
    -webkit-position: -webkit-sticky;
    position: sticky;
    position: fixed;
  }
  
  .navigation-fixed {
    -webkit-position: sticky;
    -webkit-position: -webkit-sticky;
    position: sticky;
    position: fixed;
  }
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
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.member-avatar {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.member-avatar.selected {
  box-shadow: 0 0 0 3px #6366f1, 0 0 20px rgba(99, 102, 241, 0.4);
}

.mobile-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.group-selector {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.group-selector:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

/* w-13 h-13 클래스 정의 (52px) */
.w-13 {
  width: 3.25rem; /* 52px */
}

.h-13 {
  height: 3.25rem; /* 52px */
}

@media (max-width: 640px) {
  .member-avatar {
    width: 48px; 
    height: 48px; 
  }
}

/* glass-effect 스타일 추가 */
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

/* 지도 화면 전체 차지하기 위한 스타일 */
.full-map-container {
  position: fixed !important;
  top: 0 !important; /* 헤더 아래부터 시작하지 않고 화면 최상단부터 시작 */
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important; /* 지도 터치 이벤트를 위해 visible로 변경 */
  touch-action: manipulation !important; /* 지도 조작을 위한 터치 이벤트 허용 */
  z-index: 1 !important; /* 헤더와 네비게이션보다 낮게 설정 */
}

/* 지도 헤더 스타일 */
.map-header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px;
  min-width: 80px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 구글맵 InfoWindow 기본 스타일 숨기기 */
.gm-style .gm-style-iw-c {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  border: none !important;
  padding: 0 !important;
}

.gm-style .gm-style-iw-d {
  overflow: visible !important;
}

.gm-style .gm-style-iw-t::after {
  display: none !important;
}

.gm-style .gm-style-iw-t {
  display: none !important;
}

/* 네이버맵 InfoWindow 기본 스타일 숨기기 */
.infowindow {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.infowindow .infowindow-content {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* 네이버맵 InfoWindow 화살표/꼬리 숨기기 */
.infowindow .infowindow-tail {
  display: none !important;
}

.infowindow::before,
.infowindow::after {
  display: none !important;
}

/* 네이버맵 InfoWindow 추가 스타일 숨기기 */
.naver-infowindow,
.naver-infowindow-content,
.naver-infowindow-wrapper {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 모든 네이버맵 관련 InfoWindow 요소 숨기기 */
[class*="infowindow"] {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

[class*="InfoWindow"] {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 네이버맵 말풍선 스타일 완전 제거 */
.naver-maps-infowindow,
.naver-maps-infowindow-content,
.naver-maps-infowindow-container {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* 지도 컨트롤 버튼들 스타일 */
.map-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-control-button {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  color: #374151;
}

.map-control-button:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
}

/* 바텀시트 스타일 - location/page.tsx 패턴 적용 */
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: none;
  user-select: none;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.1);
}

.bottom-sheet-handle {
  width: 40px;
  height: 4px;
  background: #d1d5db;
  border-radius: 2px;
  margin: 12px auto 8px;
  cursor: grab;
  transition: background-color 0.2s;
}

.bottom-sheet-handle:active {
  cursor: grabbing;
}

.bottom-sheet-handle:hover {
  background: #9ca3af;
}

/* 바텀시트 상태별 위치 - framer-motion으로 제어되므로 제거 */
/* location/page.tsx에서는 framer-motion variants로 처리 */

/* 콘텐츠 섹션 스타일 */
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

/* 애니메이션 키프레임 */
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
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
  animation: slideUp 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-fadeIn {
  animation: fadeIn 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
`;

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

const memberAvatarVariants = {
  initial: { 
    opacity: 0, 
    x: -20,
    scale: 0.8
  },
  animate: (index: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: index * 0.1,
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  }),
  hover: {
    scale: 1.1,
    y: -5,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15
    }
  },
  selected: {
    scale: 1.15,
    y: -8,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15
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

// ... existing code ...

// Helper 함수들 추가
const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/';

// iOS WebView에서 안전한 배열 체크 유틸리티 함수
const safeIsArray = (value: any): value is any[] => {
  try {
    // Array 생성자가 존재하고 isArray 메소드가 있는지 확인
    if (typeof Array !== 'undefined' && Array && typeof Array.isArray === 'function') {
      return Array.isArray(value);
    }
    
    // Array.isArray가 사용할 수 없으면 Object.prototype.toString 사용
    if (typeof Object !== 'undefined' && Object && Object.prototype && Object.prototype.toString) {
      return Object.prototype.toString.call(value) === '[object Array]';
    }
    
    // 마지막 수단: instanceof 체크
    if (value && typeof value === 'object' && value.constructor === Array) {
      return true;
    }
    
    // 모든 방법이 실패하면 기본적인 속성 체크
    return !!(value && typeof value === 'object' && 
             typeof value.length === 'number' && 
             typeof value.push === 'function' &&
             typeof value.slice === 'function');
  } catch (error) {
    console.warn('[safeIsArray] 배열 체크 중 오류:', error);
    return false;
  }
};

// 안전한 배열 체크 함수 (null/undefined도 안전하게 처리)
const safeArrayCheck = (value: any): value is any[] => {
  if (value === null || value === undefined) {
    return false;
  }
  return safeIsArray(value);
};

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

// 안전한 이미지 URL을 반환하는 함수
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  // location/page.tsx와 동일한 로직: 실제 사진이 있으면 사용하고, 없으면 기본 이미지 사용
  return photoUrl ?? getDefaultImage(gender, index);
};



// 일정 상태 관련 상수 및 함수 추가 (schedule/page.tsx 참고)
const statusNameMap = {
  completed: '완료',
  ongoing: '진행 중',
  upcoming: '예정',
  default: '상태 없음'
};

const statusColorMap = {
  completed: '#22c55e', // green-500
  ongoing: '#f97316',   // orange-500
  upcoming: '#3b82f6', // blue-500
  default: '#6b7280'  // gray-500
};

const statusBgColorMap = {
  completed: '#f0fdf4', // green-50
  ongoing: '#fff7ed',   // orange-50
  upcoming: '#eff6ff',    // blue-50
  default: '#f9fafb'   // gray-50
};

// Schedule 타입의 sst_sdate, sst_edate를 사용하도록 수정
const getScheduleStatus = (schedule: Schedule): { name: 'completed' | 'ongoing' | 'upcoming' | 'default'; text: string; color: string; bgColor: string } => {
  const now = new Date();
  
  if (!schedule.date || !schedule.sst_edate) { // schedule.date는 sst_sdate의 날짜 부분, sst_edate는 종료일시
    return { name: 'default', text: statusNameMap.default, color: statusColorMap.default, bgColor: statusBgColorMap.default };
  }

  // sst_sdate (시작일시) 와 sst_edate (종료일시)는 완전한 datetime 문자열로 가정
  // 예: "2023-10-27 09:00:00"
  const eventStartDate = new Date(schedule.date); // schedule.date는 YYYY-MM-DD 형식이어야 함
  let eventStartDateTime: Date;
  let eventEndDateTime: Date;

  try {
    // schedule.date (YYYY-MM-DD)와 시간정보가 포함된 sst_sdate, sst_edate를 조합하거나,
    // sst_sdate와 sst_edate가 이미 완전한 datetime 문자열이라면 그대로 사용.
    // scheduleService에서 date 필드는 sst_sdate의 날짜 부분만 사용하고 있으므로,
    // 시간 정보를 얻기 위해 sst_sdate 원본을 사용하거나, schedule 객체에 sst_sdate 전체가 있다면 사용.
    // 여기서는 schedule.date (날짜) 와 sst_sdate (시간 포함 시작) / sst_edate (시간 포함 종료)를 사용한다고 가정.
    // schedule.date가 YYYY-MM-DD 형식이고, sst_sdate/sst_edate가 HH:mm:ss 형식이면 조합 필요.
    // 여기서는 sst_sdate와 sst_edate가 완전한 ISO 날짜 문자열이라고 가정하고 진행 (예: '2024-07-30T10:00:00')
    // 또는 scheduleService에서 매핑 시 date (sst_sdate에서 시간까지 포함), sst_edate를 ISO 형식으로 변환했다고 가정.
    // 현재 Schedule 인터페이스의 date는 string | null (sst_sdate datetime string)으로 되어 있으므로, 이를 Date 객체로 변환.
    
    if (!schedule.date) { // sst_sdate가 없을 경우
        throw new Error('Schedule start date is missing');
    }
    eventStartDateTime = new Date(schedule.date); // sst_sdate 전체를 사용

    if (!schedule.sst_edate) { // 종료 시간이 없으면 시작 시간과 동일하게 처리하거나, 특정 기간(예: 1시간)을 더함
        eventEndDateTime = new Date(eventStartDateTime.getTime() + 60 * 60 * 1000); // 예: 1시간 후로 설정
        // console.warn(`Schedule ${schedule.id} has no end date. Defaulting to 1 hour duration.`);
    } else {
        eventEndDateTime = new Date(schedule.sst_edate);
    }

    if (isNaN(eventStartDateTime.getTime()) || isNaN(eventEndDateTime.getTime())) {
      // console.error("Invalid date format for schedule status check:", schedule);
      return { name: 'default', text: '시간오류', color: statusColorMap.default, bgColor: statusBgColorMap.default };
    }
  } catch (e) {
    // console.error("Error parsing date for schedule status check:", e, schedule);
    return { name: 'default', text: '시간오류', color: statusColorMap.default, bgColor: statusBgColorMap.default };
  }

  if (now > eventEndDateTime) {
    return { name: 'completed', text: statusNameMap.completed, color: statusColorMap.completed, bgColor: statusBgColorMap.completed };
  }
  if (now >= eventStartDateTime && now <= eventEndDateTime) {
    return { name: 'ongoing', text: statusNameMap.ongoing, color: statusColorMap.ongoing, bgColor: statusBgColorMap.ongoing };
  }
  if (now < eventStartDateTime) {
    return { name: 'upcoming', text: statusNameMap.upcoming, color: statusColorMap.upcoming, bgColor: statusBgColorMap.upcoming };
  }
  return { name: 'default', text: statusNameMap.default, color: statusColorMap.default, bgColor: statusBgColorMap.default };
};

export default function HomePage() {
  // 🛡️ 최상위 에러 캐처
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [renderAttempts, setRenderAttempts] = useState(0);
  
  // 🚨 iOS 시뮬레이터 디버깅 - 즉시 실행 로그
  console.log('🏠 [HOME] HomePage 컴포넌트 시작');
  
  // 🔧 초기 환경 체크를 try-catch로 감싸기
  try {
    console.log('🏠 [HOME] 환경 체크:', {
      isIOSWebView: !!(window as any).webkit?.messageHandlers,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      isClient: typeof window !== 'undefined',
      timestamp: new Date().toISOString()
    });
  } catch (envError) {
    console.error('🏠 [HOME] 환경 체크 중 오류:', envError);
    setCriticalError(`환경 체크 오류: ${envError}`);
  }
  
  // 🚨 iOS 시뮬레이터 에러 핸들링
  const [componentError, setComponentError] = useState<string | null>(null);
  
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('🏠 [HOME] ❌ 전역 에러 감지:', {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error,
        stack: error.error?.stack
      });
      setComponentError(`전역 에러 (${error.filename}:${error.lineno}): ${error.message}`);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🏠 [HOME] ❌ Promise rejection 감지:', {
        reason: event.reason,
        stack: event.reason?.stack,
        type: typeof event.reason
      });
      setComponentError(`Promise 에러: ${String(event.reason)}`);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  const router = useRouter();
  // 인증 관련 상태 추가
  const { user, isLoggedIn, loading: authLoading, isPreloadingComplete } = useAuth();
  
  // 🔧 사용자 정보 디버깅
  useEffect(() => {
    if (user) {
      console.log('🔧 [HOME] AuthContext 사용자 정보 확인:', {
        mt_idx: user.mt_idx,
        mt_name: user.mt_name,
        mt_email: user.mt_email,
        isLoggedIn,
        authLoading,
        isPreloadingComplete
      });
    }
  }, [user, isLoggedIn, authLoading, isPreloadingComplete]);

  // InfoWindow 닫기를 위한 전역 함수 설정
  useEffect(() => {
    // InfoWindow 닫기 전역 함수
    (window as any).closeCurrentInfoWindow = () => {
      console.log('[InfoWindow 닫기] 요청');
      if (currentInfoWindowRef.current) {
        try {
          currentInfoWindowRef.current.close();
          currentInfoWindowRef.current = null;
          console.log('[InfoWindow 닫기] 성공');
        } catch (error) {
          console.error('[InfoWindow 닫기] 실패:', error);
          currentInfoWindowRef.current = null;
        }
      }
    };

    // 컴포넌트 언마운트 시 전역 함수 정리
    return () => {
      delete (window as any).closeCurrentInfoWindow;
    };
  }, []);
      // UserContext 사용
    const { 
      userInfo, 
      userGroups, 
      isUserDataLoading, 
      userDataError, 
      refreshUserData,
      selectedGroupId: userContextSelectedGroupId,
      setSelectedGroupId: setUserContextSelectedGroupId
    } = useUser();
   
    // 데이터 캐시 컨텍스트
    const { 
      getUserProfile, 
      getUserGroups, 
      getGroupMembers, 
      getScheduleData,
      getLocationData,
      getGroupPlaces,
      getDailyLocationCounts,
      isCacheValid
    } = useDataCache();
    
    const [userName, setUserName] = useState('사용자');
  const [userLocation, setUserLocation] = useState<Location>({ lat: 37.5642, lng: 127.0016 }); // 기본: 서울
  const [locationName, setLocationName] = useState('서울시');
  const [recommendedPlaces, setRecommendedPlaces] = useState(RECOMMENDED_PLACES);
  const [favoriteLocations, setFavoriteLocations] = useState([
    { id: '1', name: '회사', address: '서울시 강남구 테헤란로 123' },
    { id: '2', name: '자주 가는 카페', address: '서울시 강남구 역삼동 234' },
  ]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(''); // 빈 문자열로 초기화, useEffect에서 설정

  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [mapType, setMapType] = useState<MapType>('naver'); // 🗺️ 기본 지도를 네이버맵으로 설정
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [daysForCalendar, setDaysForCalendar] = useState<{ value: string; display: string; }[]>([]); // 달력 날짜 상태 추가
  
  // 별도의 컨테이너 사용 - 지도 타입 전환 시 DOM 충돌 방지
  const googleMapContainer = useRef<HTMLDivElement>(null);
  const naverMapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const naverMap = useRef<any>(null);
  const naverMarker = useRef<any>(null);
  const memberMarkers = useRef<any[]>([]);
  const scheduleMarkersRef = useRef<any[]>([]); // 스케줄 마커를 위한 ref 추가
  
  // InfoWindow 참조 관리를 위한 ref 추가
  const currentInfoWindowRef = useRef<any>(null);
  
  // 스크립트 로드 및 지도 초기화 상태 추적
  const [mapsInitialized, setMapsInitialized] = useState({
    google: false,
    naver: false
  });

  // 바텀시트 제거됨

  const dataFetchedRef = useRef({ members: false, schedules: false, loading: false, currentGroupId: null as number | null }); // dataFetchedRef를 객체로 변경

  // 마커 업데이트 중복 방지를 위한 ref
  const markersUpdating = useRef<boolean>(false);
  const lastSelectedMemberRef = useRef<string | null>(null); // 마지막 선택된 멤버 추적


  const [groupSchedules, setGroupSchedules] = useState<Schedule[]>([]); // 그룹 전체 스케줄 (memberId 포함)
  // const [dataFetched, setDataFetched] = useState({ members: false, schedules: false }); // 삭제
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false); // 첫번째 멤버 선택 완료 상태 추가
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({}); // 그룹별 멤버 수 캐시
  const [hasNewNotifications, setHasNewNotifications] = useState(false); // 새로운 알림 여부

  // 그룹 관련 상태 - UserContext로 대체됨
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [firstMemberSelected, setFirstMemberSelected] = useState(false); // 첫번째 멤버 선택 완료 추적
  // selectedGroupId는 UserContext에서 관리
  const selectedGroupId = userContextSelectedGroupId;
  const setSelectedGroupId = setUserContextSelectedGroupId;

  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // 달력 스와이프 관련 상태 - calendarBaseDate 제거, x만 유지
  const x = useMotionValue(0); // 드래그 위치를 위한 motionValue
  const sidebarDateX = useMotionValue(0); // 사이드바 날짜 선택용 motionValue

  // 사이드바 상태 추가
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarDraggingRef = useRef(false); // 사이드바 드래그용 ref
  
  // 환경 감지 관련 상태
  const [environment, setEnvironment] = useState<EnvironmentConfig | null>(null);
  const [mapApiLoader, setMapApiLoader] = useState<MapApiLoader | null>(null);
  const [networkStatus, setNetworkStatus] = useState<boolean>(true);
  const [domainDiagnostics, setDomainDiagnostics] = useState<any>(null);

  // 환경 감지 및 초기화 (최우선 실행)
  useEffect(() => {
    console.log('🌐 [ENVIRONMENT] 환경 감지 시작');
    
    try {
      // 환경 감지
      const env = detectEnvironment();
      setEnvironment(env);
      
      // 환경 정보 로깅
      logEnvironmentInfo(env);
      
      // 지도 API 로더 초기화
      const apiLoader = new MapApiLoader(env);
      setMapApiLoader(apiLoader);
      
      // 네트워크 상태 확인
      checkNetworkStatus().then(setNetworkStatus).catch(err => {
        console.error('네트워크 상태 확인 실패:', err);
        setNetworkStatus(false);
      });
      
      // 도메인별 진단 정보 수집
      const diagnostics = {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        port: window.location.port,
        isLocalhost: env.isLocalhost,
        isProduction: env.isProduction,
        isSecure: env.isSecure,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };
      setDomainDiagnostics(diagnostics);
      
      console.log('🌐 [ENVIRONMENT] 환경 초기화 완료:', diagnostics);
      
    } catch (error) {
      console.error('❌ [ENVIRONMENT] 환경 초기화 실패:', error);
      setCriticalError(`환경 초기화 오류: ${error}`);
    }
  }, []);

  // 홈 페이지임을 명시하기 위한 body 속성 설정
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-page', '/home');
      document.documentElement.setAttribute('data-page', '/home');
      // 네비게이션 바가 표시되도록 클래스 제거
      document.body.classList.remove('hide-bottom-nav');
      console.log('🏠 [HOME] 홈 페이지 body 속성 설정 완료');
    }
    
    return () => {
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-page');
        document.documentElement.removeAttribute('data-page');
        console.log('🏠 [HOME] 홈 페이지 body 속성 제거 완료');
      }
    };
  }, []);
  
  // useEffect를 사용하여 클라이언트 사이드에서 날짜 관련 상태 초기화
  useEffect(() => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      setSelectedDate(todayStr);
      setDaysForCalendar(getNext7Days());
      console.log('🏠 [HOME] 날짜 초기화 완료');
    } catch (error) {
      console.error('🏠 [HOME] 날짜 초기화 실패:', error);
      setCriticalError(`날짜 초기화 오류: ${error}`);
    }
  }, []); // 빈 배열로 전달하여 마운트 시 1회 실행

  // UserContext 데이터가 로딩 완료되면 첫 번째 그룹을 자동 선택
  useEffect(() => {
    console.log('🏠 [HOME] UserContext 상태 체크:', {
      isUserDataLoading,
      userGroupsLength: userGroups.length,
      selectedGroupId,
      authLoading,
      isPreloadingComplete
    });
    
    // 🚨 iOS 시뮬레이터 디버깅 - 단계별 체크
    try {
      // UserContext에서 그룹과 selectedGroupId 모두 관리되므로 로그만 출력
      console.log('🏠 [HOME] UserContext 상태 확인:', {
        userGroupsLength: userGroups.length,
        selectedGroupId: selectedGroupId,
        isUserDataLoading: isUserDataLoading,
        authLoading: authLoading
      });
      
      // UserContext에서 자동으로 그룹 선택하므로 여기서는 별도 처리 불필요
      if (selectedGroupId) {
        console.log('🏠 [HOME] ✅ UserContext에서 그룹 선택됨:', selectedGroupId);
      } else if (userGroups.length > 0) {
        console.log('🏠 [HOME] ⚠️ 그룹은 있지만 선택되지 않음 - UserContext 동기화 대기');
      } else {
        console.log('🏠 [HOME] ⚠️ 그룹이 없음 - 신규 사용자이거나 데이터 로딩 중');
      }
    } catch (error) {
      console.error('🏠 [HOME] ❌ 첫 번째 그룹 선택 실패:', error);
    }
  }, [authLoading, isUserDataLoading, userGroups.length]); // 조건을 더 민감하게 변경

  // selectedGroupId 상태 변화 추적 및 데이터 초기화
  useEffect(() => {
    console.log('[HOME] selectedGroupId 상태 변화:', selectedGroupId);
    
    // selectedGroupId가 변경되면 데이터 로딩 상태 초기화
    if (selectedGroupId) {
      console.log('[HOME] 새로운 그룹 선택으로 데이터 로딩 상태 초기화');
      dataFetchedRef.current.members = false;
      dataFetchedRef.current.schedules = false;
      dataFetchedRef.current.loading = false;
      setIsFirstMemberSelectionComplete(false);
      setFirstMemberSelected(false); // 첫 번째 멤버 선택 상태도 초기화
    }
  }, [selectedGroupId]);

  // 바텀시트 제거됨

  // 바텀시트 제거됨

  // 바텀시트 제거됨

  // 사용자 위치 및 지역명 가져오기
  useEffect(() => {
    console.log('🏠 [HOME] 위치 정보 요청 시작');
    
    try {
      if (navigator.geolocation) {
        console.log('🏠 [HOME] Geolocation API 사용 가능');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            console.log('🏠 [HOME] ✅ 위치 정보 획득 성공:', { latitude, longitude });
            setUserLocation({ lat: latitude, lng: longitude });
            setIsLocationEnabled(true);
            
            // 정적 위치 정보 설정 (Geocoding API 대신 간단한 해결책)
            setLocationName("현재 위치");
          },
          (error) => {
            console.error('🏠 [HOME] ❌ 위치 정보 획득 실패:', error);
            setIsLocationEnabled(false);
            // 기본 위치로 폴백
            setUserLocation({ lat: 37.5642, lng: 127.0016 });
            setLocationName("서울시");
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5분간 캐시
          }
        );
      } else {
        console.error('🏠 [HOME] ❌ Geolocation API 지원하지 않음');
        setIsLocationEnabled(false);
        setUserLocation({ lat: 37.5642, lng: 127.0016 });
        setLocationName("서울시");
      }
    } catch (error) {
      console.error('🏠 [HOME] ❌ 위치 정보 요청 중 예외 발생:', error);
      setIsLocationEnabled(false);
      setUserLocation({ lat: 37.5642, lng: 127.0016 });
      setLocationName("서울시");
    }
  }, []);

  // 그룹 멤버 및 스케줄 데이터 가져오기
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllGroupData = async () => {
      // 중복 실행 방지 - 이미 로딩 중이거나 해당 그룹의 데이터가 이미 로드된 경우
      if (dataFetchedRef.current.loading) {
        console.log('[fetchAllGroupData] 중복 실행 방지 - 이미 로딩 중');
        return;
      }
      
      // 🔥 AuthContext의 로딩이 완료될 때까지만 기다리기 (프리로딩 조건 완화)
      if (authLoading) {
        console.log('🏠 [fetchAllGroupData] AuthContext 로딩 중이므로 대기:', { authLoading, isPreloadingComplete });
        return;
      }
      
      // 프리로딩 완료를 기다리지 않고 진행 (사용자 경험 개선)
      if (!isPreloadingComplete) {
        console.log('🏠 [fetchAllGroupData] ⚠️ 프리로딩 미완료지만 진행 (UX 개선):', { authLoading, isPreloadingComplete });
        // 프리로딩을 기다리지 않고 바로 진행 (응답성 개선)
      }
      
      console.log('🏠 [fetchAllGroupData] ✅ AuthContext 체크 완료, 데이터 페칭 시작');

      const groupIdToUse = selectedGroupId?.toString() || '';
      if (!groupIdToUse) {
        console.log('[fetchAllGroupData] selectedGroupId가 없어서 실행 중단');
        return;
      }

      // 이미 해당 그룹의 데이터가 로드되었는지 확인
      if (dataFetchedRef.current.currentGroupId === parseInt(groupIdToUse) && 
          dataFetchedRef.current.members && 
          dataFetchedRef.current.schedules) {
        console.log('[fetchAllGroupData] 중복 실행 방지 - 해당 그룹 데이터 이미 로드됨:', {
          currentGroupId: dataFetchedRef.current.currentGroupId,
          selectedGroupId: parseInt(groupIdToUse),
          members: dataFetchedRef.current.members,
          schedules: dataFetchedRef.current.schedules
        });
        return;
      }
      
      // 로딩 시작 플래그 설정
      dataFetchedRef.current.loading = true;

      dataFetchedRef.current.currentGroupId = parseInt(groupIdToUse);

      try {
        let currentMembers: GroupMember[] = groupMembers.length > 0 ? [...groupMembers] : [];

        if (!dataFetchedRef.current.members) {
          console.log('[fetchAllGroupData] 멤버 데이터 로딩 시작');
          
          // 🔥 캐시된 데이터 먼저 확인
          const cachedMembers = getGroupMembers(parseInt(groupIdToUse));
          const isMemberCacheValid = isCacheValid('groupMembers', parseInt(groupIdToUse));
          
          if (cachedMembers && cachedMembers.length > 0 && isMemberCacheValid) {
            console.log('[fetchAllGroupData] 유효한 캐시된 멤버 데이터 사용:', cachedMembers.length, '명');
            currentMembers = (cachedMembers && safeArrayCheck(cachedMembers)) ? cachedMembers.map((member: any, index: number) => ({
              id: member.mt_idx.toString(),
              name: member.mt_name || `멤버 ${index + 1}`,
              photo: getSafeImageUrl(member.mt_file1, member.mt_gender, index),
              isSelected: false,
              location: { 
                lat: member.mlt_lat !== null && member.mlt_lat !== undefined 
                  ? parseFloat(member.mlt_lat.toString()) 
                  : parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
                lng: member.mlt_long !== null && member.mlt_long !== undefined 
                  ? parseFloat(member.mlt_long.toString()) 
                  : parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
              },
              schedules: [], 
              mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
              original_index: index,
              mlt_lat: member.mlt_lat,
              mlt_long: member.mlt_long,
              mlt_speed: member.mlt_speed,
              mlt_battery: member.mlt_battery,
              mlt_gps_time: member.mlt_gps_time,
              sgdt_owner_chk: member.sgdt_owner_chk,
              sgdt_leader_chk: member.sgdt_leader_chk,
              sgdt_idx: member.sgdt_idx
            })) : [];
          } else {
            // 🔥 캐시된 데이터가 없거나 만료되었을 때만 API 호출
            // AuthContext 프리로딩이 진행 중일 수 있으므로 잠시 대기
            console.log('[fetchAllGroupData] 캐시된 멤버 데이터 없음 또는 만료 - 잠시 대기 후 API 호출');
            
            // 500ms 대기 후 다시 캐시 확인
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const cachedMembersRetry = getGroupMembers(parseInt(groupIdToUse));
            const isMemberCacheValidRetry = isCacheValid('groupMembers', parseInt(groupIdToUse));
            
            if (cachedMembersRetry && cachedMembersRetry.length > 0 && isMemberCacheValidRetry) {
              console.log('[fetchAllGroupData] 대기 후 캐시된 멤버 데이터 발견:', cachedMembersRetry.length, '명');
              currentMembers = (cachedMembersRetry && safeArrayCheck(cachedMembersRetry)) ? cachedMembersRetry.map((member: any, index: number) => ({
                id: member.mt_idx.toString(),
                name: member.mt_name || `멤버 ${index + 1}`,
                photo: getSafeImageUrl(member.mt_file1, member.mt_gender, index),
                isSelected: false,
                location: { 
                  lat: member.mlt_lat !== null && member.mlt_lat !== undefined 
                    ? parseFloat(member.mlt_lat.toString()) 
                    : parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
                  lng: member.mlt_long !== null && member.mlt_long !== undefined 
                    ? parseFloat(member.mlt_long.toString()) 
                    : parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
                },
                schedules: [], 
                mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
                original_index: index,
                mlt_lat: member.mlt_lat,
                mlt_long: member.mlt_long,
                mlt_speed: member.mlt_speed,
                mlt_battery: member.mlt_battery,
                mlt_gps_time: member.mlt_gps_time,
                sgdt_owner_chk: member.sgdt_owner_chk,
                sgdt_leader_chk: member.sgdt_leader_chk,
                sgdt_idx: member.sgdt_idx
              })) : [];
            } else {
              // 여전히 캐시가 없으면 API 호출
              console.log('[fetchAllGroupData] 대기 후에도 캐시 없음 - API 호출 실행');
              try {
                const memberData = await memberService.getGroupMembers(groupIdToUse);
                if (isMounted) { 
                  if (memberData && memberData.length > 0) { 
                    currentMembers = (memberData && safeArrayCheck(memberData)) ? memberData.map((member: any, index: number) => ({
                      id: member.mt_idx.toString(),
                      name: member.mt_name || `멤버 ${index + 1}`,
                      photo: getSafeImageUrl(member.mt_file1, member.mt_gender, index),
                      isSelected: false,
                      location: { 
                        lat: member.mlt_lat !== null && member.mlt_lat !== undefined 
                          ? parseFloat(member.mlt_lat.toString()) 
                          : parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
                        lng: member.mlt_long !== null && member.mlt_long !== undefined 
                          ? parseFloat(member.mlt_long.toString()) 
                          : parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
                      },
                      schedules: [], 
                      mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
                      original_index: index,
                      mlt_lat: member.mlt_lat,
                      mlt_long: member.mlt_long,
                      mlt_speed: member.mlt_speed,
                      mlt_battery: member.mlt_battery,
                      mlt_gps_time: member.mlt_gps_time,
                      sgdt_owner_chk: member.sgdt_owner_chk,
                      sgdt_leader_chk: member.sgdt_leader_chk,
                      sgdt_idx: member.sgdt_idx
                    })) : [];
                    console.log('[fetchAllGroupData] ✅ API 호출로 멤버 데이터 획득:', currentMembers.length, '명');
                  } else {
                    console.warn('[fetchAllGroupData] API 응답에 멤버 데이터 없음 - 기본 멤버 생성');
                    // 기본 멤버 생성 (최소 1명은 보장) - 현재 위치 사용
                    if (user) {
                      console.log('🔧 [fetchAllGroupData] 기본 멤버 생성 - 사용자 정보:', {
                        mt_idx: user.mt_idx,
                        mt_name: user.mt_name,
                        mt_email: user.mt_email,
                        selectedGroupId: groupIdToUse
                      });
                      
                      // 현재 위치를 우선적으로 사용, 없으면 기본값
                      let memberLat = parseFloat(String(user.mt_lat || '37.5642'));
                      let memberLng = parseFloat(String(user.mt_long || '127.0016'));
                      
                      // 현재 위치가 있으면 사용
                      if (userLocation.lat && userLocation.lng) {
                        memberLat = userLocation.lat;
                        memberLng = userLocation.lng;
                        console.log('🔧 [fetchAllGroupData] 현재 GPS 위치로 멤버 생성:', { lat: memberLat, lng: memberLng });
                      } else {
                        // 현재 위치 시도
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const { latitude, longitude } = position.coords;
                              console.log('🔧 [fetchAllGroupData] 실시간 GPS 위치 획득:', { latitude, longitude });
                              
                              // 멤버 위치 업데이트
                              setGroupMembers(prevMembers =>
                                prevMembers.map(member => ({
                                  ...member,
                                  location: { lat: latitude, lng: longitude },
                                  mlt_lat: latitude,
                                  mlt_long: longitude
                                }))
                              );
                            },
                            (error) => {
                              console.warn('🔧 [fetchAllGroupData] GPS 위치 획득 실패:', error);
                            },
                            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
                          );
                        }
                      }
                      
                      currentMembers = [{
                        id: user.mt_idx.toString(),
                        name: user.mt_name || '나',
                        photo: getSafeImageUrl(user.mt_file1 || null, user.mt_gender, 0),
                        isSelected: false,
                        location: { 
                          lat: memberLat, 
                          lng: memberLng 
                        },
                        schedules: [], 
                        mt_gender: user.mt_gender || null,
                        original_index: 0,
                        mlt_lat: memberLat,
                        mlt_long: memberLng,
                        mlt_speed: null,
                        mlt_battery: null,
                        mlt_gps_time: new Date().toISOString(),
                        sgdt_owner_chk: 'Y',
                        sgdt_leader_chk: 'Y',
                        sgdt_idx: undefined
                      }];
                      console.log('[fetchAllGroupData] 기본 멤버 생성 완료:', user.mt_name, 'ID:', user.mt_idx, '위치:', { lat: memberLat, lng: memberLng });
                    }
                    setIsFirstMemberSelectionComplete(true);
                  }
                }
              } catch (apiError) {
                console.error('[fetchAllGroupData] 멤버 API 호출 실패:', apiError);
                // API 호출 실패 시에도 기본 멤버 생성 - 현재 위치 사용
                if (user) {
                  console.log('🔧 [fetchAllGroupData] API 실패 시 기본 멤버 생성 - 사용자 정보:', {
                    mt_idx: user.mt_idx,
                    mt_name: user.mt_name,
                    mt_email: user.mt_email,
                    selectedGroupId: groupIdToUse,
                    apiError: apiError instanceof Error ? apiError.message : String(apiError)
                  });
                  
                  // 현재 위치를 우선적으로 사용, 없으면 기본값
                  let memberLat = parseFloat(String(user.mt_lat || '37.5642'));
                  let memberLng = parseFloat(String(user.mt_long || '127.0016'));
                  
                  // 현재 위치가 있으면 사용
                  if (userLocation.lat && userLocation.lng) {
                    memberLat = userLocation.lat;
                    memberLng = userLocation.lng;
                    console.log('🔧 [fetchAllGroupData] API 실패 - 현재 GPS 위치로 멤버 생성:', { lat: memberLat, lng: memberLng });
                  }
                  
                  currentMembers = [{
                    id: user.mt_idx.toString(),
                    name: user.mt_name || '나',
                    photo: getSafeImageUrl(user.mt_file1 || null, user.mt_gender, 0),
                    isSelected: false,
                    location: { 
                      lat: memberLat, 
                      lng: memberLng 
                    },
                    schedules: [], 
                    mt_gender: user.mt_gender || null,
                    original_index: 0,
                    mlt_lat: memberLat,
                    mlt_long: memberLng,
                    mlt_speed: null,
                    mlt_battery: null,
                    mlt_gps_time: new Date().toISOString(),
                    sgdt_owner_chk: 'Y',
                    sgdt_leader_chk: 'Y',
                    sgdt_idx: undefined
                  }];
                  console.log('[fetchAllGroupData] API 실패 시 기본 멤버 생성 완료:', user.mt_name, 'ID:', user.mt_idx, '위치:', { lat: memberLat, lng: memberLng });
                }
              }
            }
          }
          
          if (isMounted && currentMembers.length > 0) {
            setGroupMembers(currentMembers); 
            console.log('[fetchAllGroupData] 멤버 데이터 로딩 완료:', currentMembers.length, '명');
            
            // 멤버 수 업데이트
            setGroupMemberCounts(prevCounts => ({
              ...prevCounts,
              [parseInt(groupIdToUse)]: currentMembers.length
            }));
            console.log('[fetchAllGroupData] 그룹 멤버 수 업데이트:', parseInt(groupIdToUse), '→', currentMembers.length, '명');
            
            dataFetchedRef.current.members = true;
          }
        }

        if (dataFetchedRef.current.members && !dataFetchedRef.current.schedules) {
          console.log('[fetchAllGroupData] 스케줄 데이터 로딩 시작');
          
          // 🔥 캐시된 스케줄 데이터 먼저 확인
          const today = new Date().toISOString().split('T')[0];
          const cachedSchedules: any = getScheduleData(parseInt(groupIdToUse), today);
          const isScheduleCacheValid = isCacheValid('scheduleData', parseInt(groupIdToUse), today);
          
          let rawSchedules: any[] = [];
          
          if (cachedSchedules && isScheduleCacheValid) {
            if (cachedSchedules && safeArrayCheck(cachedSchedules)) {
              console.log('[fetchAllGroupData] 유효한 캐시된 스케줄 데이터 사용 (배열):', cachedSchedules.length, '개');
              rawSchedules = cachedSchedules;
            } else if (cachedSchedules.data && cachedSchedules.data.schedules) {
              console.log('[fetchAllGroupData] 유효한 캐시된 스케줄 데이터 사용 (객체):', cachedSchedules.data.schedules.length, '개');
              rawSchedules = cachedSchedules.data.schedules;
            } else {
              console.log('[fetchAllGroupData] 캐시된 스케줄 데이터 형태 확인 불가 - 대기 후 재시도');
              
              // 500ms 대기 후 다시 캐시 확인
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const cachedSchedulesRetry: any = getScheduleData(parseInt(groupIdToUse), today);
              const isScheduleCacheValidRetry = isCacheValid('scheduleData', parseInt(groupIdToUse), today);
              
              if (cachedSchedulesRetry && isScheduleCacheValidRetry) {
                if (cachedSchedulesRetry && safeArrayCheck(cachedSchedulesRetry)) {
                  console.log('[fetchAllGroupData] 대기 후 캐시된 스케줄 데이터 발견 (배열):', cachedSchedulesRetry.length, '개');
                  rawSchedules = cachedSchedulesRetry;
                } else if (cachedSchedulesRetry.data && cachedSchedulesRetry.data.schedules) {
                  console.log('[fetchAllGroupData] 대기 후 캐시된 스케줄 데이터 발견 (객체):', cachedSchedulesRetry.data.schedules.length, '개');
                  rawSchedules = cachedSchedulesRetry.data.schedules;
                } else {
                  console.log('[fetchAllGroupData] 대기 후에도 캐시 형태 확인 불가 - API 호출');
                  const scheduleResponse = await scheduleService.getGroupSchedules(parseInt(groupIdToUse)); 
                  if (scheduleResponse && scheduleResponse.data && scheduleResponse.data.schedules) {
                    rawSchedules = scheduleResponse.data.schedules;
                  }
                }
              } else {
                console.log('[fetchAllGroupData] 대기 후에도 캐시 없음 - API 호출');
                const scheduleResponse = await scheduleService.getGroupSchedules(parseInt(groupIdToUse)); 
                if (scheduleResponse && scheduleResponse.data && scheduleResponse.data.schedules) {
                  rawSchedules = scheduleResponse.data.schedules;
                }
              }
            }
          } else {
            // 캐시된 데이터가 없거나 만료되었으면 잠시 대기 후 재확인
            console.log('[fetchAllGroupData] 캐시된 스케줄 데이터 없음 또는 만료 - 잠시 대기 후 재확인');
            
            // 500ms 대기 후 다시 캐시 확인
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const cachedSchedulesRetry: any = getScheduleData(parseInt(groupIdToUse), today);
            const isScheduleCacheValidRetry = isCacheValid('scheduleData', parseInt(groupIdToUse), today);
            
            if (cachedSchedulesRetry && isScheduleCacheValidRetry) {
              if (cachedSchedulesRetry && safeArrayCheck(cachedSchedulesRetry)) {
                console.log('[fetchAllGroupData] 대기 후 캐시된 스케줄 데이터 발견 (배열):', cachedSchedulesRetry.length, '개');
                rawSchedules = cachedSchedulesRetry;
              } else if (cachedSchedulesRetry.data && cachedSchedulesRetry.data.schedules) {
                console.log('[fetchAllGroupData] 대기 후 캐시된 스케줄 데이터 발견 (객체):', cachedSchedulesRetry.data.schedules.length, '개');
                rawSchedules = cachedSchedulesRetry.data.schedules;
              }
            } else {
              // 여전히 캐시가 없으면 API 호출
              console.log('[fetchAllGroupData] 대기 후에도 캐시 없음 - API 호출 실행');
              const scheduleResponse = await scheduleService.getGroupSchedules(parseInt(groupIdToUse)); 
              if (scheduleResponse && scheduleResponse.data && scheduleResponse.data.schedules) {
                rawSchedules = scheduleResponse.data.schedules;
              }
            }
          }
          
          if (isMounted && rawSchedules.length > 0) {
            console.log('[fetchAllGroupData] 원본 스케줄 데이터:', (rawSchedules && safeArrayCheck(rawSchedules)) ? rawSchedules.map(s => ({
              id: s.id,
              title: s.title,
              date: s.date,
              sst_location_lat: s.sst_location_lat,
              sst_location_long: s.sst_location_long,
              location: s.location,
              sst_location_add: s.sst_location_add,
              mt_schedule_idx: s.mt_schedule_idx,
              sgdt_idx: s.sgdt_idx
            })) : []);

            // 스케줄에 statusDetail 추가
            const schedulesWithStatus = (rawSchedules && safeArrayCheck(rawSchedules)) ? rawSchedules.map((schedule: Schedule) => ({
              ...schedule,
              statusDetail: getScheduleStatus(schedule)
            })) : [];
            
            setGroupSchedules(schedulesWithStatus); 
            setGroupMembers(prevMembers =>
              (prevMembers && safeArrayCheck(prevMembers)) ? prevMembers.map(member => {
                const memberSchedules = schedulesWithStatus
                  .filter((schedule: Schedule) => 
                    schedule.sgdt_idx !== null && 
                    schedule.sgdt_idx !== undefined && 
                    Number(schedule.sgdt_idx) === Number(member.sgdt_idx)
                  );
                
                console.log(`[fetchAllGroupData] 멤버 ${member.name}의 스케줄:`, {
                  memberId: member.id,
                  memberSgdtIdx: member.sgdt_idx,
                  totalSchedules: memberSchedules.length,
                  schedulesWithLocation: memberSchedules.filter((s: any) => s.sst_location_lat && s.sst_location_long).length,
                  scheduleDetails: memberSchedules.map((s: any) => ({
                    id: s.id,
                    title: s.title,
                    date: s.date,
                    sgdt_idx: s.sgdt_idx,
                    statusDetail: s.statusDetail?.name,
                    sst_location_lat: s.sst_location_lat,
                    sst_location_long: s.sst_location_long,
                    hasLocation: !!(s.sst_location_lat && s.sst_location_long)
                  }))
                });

                return {
                  ...member,
                  schedules: memberSchedules
                };
              }) : []
            );
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const todaySchedules = (schedulesWithStatus && safeArrayCheck(schedulesWithStatus)) ? schedulesWithStatus.filter((s: Schedule) => s.date && s.date.startsWith(todayStr)) : [];
            console.log('[fetchAllGroupData] 오늘의 스케줄:', {
              todayStr,
              totalTodaySchedules: todaySchedules.length,
              schedulesWithLocation: (todaySchedules && safeArrayCheck(todaySchedules)) ? todaySchedules.filter((s: any) => s.sst_location_lat && s.sst_location_long).length : 0,
              statusDetails: (todaySchedules && safeArrayCheck(todaySchedules)) ? todaySchedules.map((s: any) => ({ id: s.id, title: s.title, status: s.statusDetail?.name })) : []
            });
            
            // 초기에는 스케줄을 빈 배열로 설정 (첫 번째 멤버 선택 후 필터링됨)
            setFilteredSchedules([]);
            console.log('[fetchAllGroupData] 스케줄 데이터 로딩 완료 (초기 빈 배열 설정):', rawSchedules.length, '개');
          } else if (isMounted) {
            console.warn('No schedule data from cache or API for the group.');
            setGroupSchedules([]);
            setFilteredSchedules([]);
          }
          
          if (isMounted) {
            dataFetchedRef.current.schedules = true; 
          }
        }
      } catch (error) {
        console.error('[HOME PAGE] 그룹 데이터(멤버 또는 스케줄) 조회 오류:', error);
        if (isMounted && !dataFetchedRef.current.members) {
          dataFetchedRef.current.members = true;
          setIsFirstMemberSelectionComplete(true);
        }
        if (isMounted && !dataFetchedRef.current.schedules) dataFetchedRef.current.schedules = true;
      } finally {
        dataFetchedRef.current.loading = false; // 로딩 완료 플래그
        if (isMounted && dataFetchedRef.current.members && dataFetchedRef.current.schedules) {
          if (isMapLoading) setIsMapLoading(false); 
          console.log("[fetchAllGroupData] 모든 그룹 데이터 로딩 완료");
          
          // 🎯 첫 번째 멤버 자동 선택 (한 번만 실행)
          if (!isFirstMemberSelectionComplete && groupMembers.length > 0) {
            setTimeout(() => {
              console.log('[fetchAllGroupData] 🎯 첫 번째 멤버 자동 선택 시작:', groupMembers[0]?.name);
              
              // 첫 번째 멤버를 선택된 상태로 설정
              setGroupMembers(prevMembers => {
                if (!prevMembers || prevMembers.length === 0) return prevMembers;
                
                const updatedMembers = prevMembers.map((member, index) => ({
                  ...member,
                  isSelected: index === 0
                }));
                
                console.log('[fetchAllGroupData] 첫 번째 멤버 선택 상태 업데이트:', updatedMembers[0]?.name);
                return updatedMembers;
              });
              
              setIsFirstMemberSelectionComplete(true);
              
              // 추가로 지도를 첫 번째 멤버 위치로 이동
              const firstMember = groupMembers[0];
              if (firstMember) {
                const realTimeLat = parseCoordinate(firstMember.mlt_lat);
                const realTimeLng = parseCoordinate(firstMember.mlt_long);
                const defaultLat = parseCoordinate(firstMember.location.lat);
                const defaultLng = parseCoordinate(firstMember.location.lng);
                
                const lat = (realTimeLat !== null && realTimeLat !== 0) ? realTimeLat : defaultLat;
                const lng = (realTimeLng !== null && realTimeLng !== 0) ? realTimeLng : defaultLng;
                
                if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
                  // 지도 위치 이동
                  if (mapType === 'naver' && naverMap.current && window.naver?.maps) {
                    const targetLatLng = createSafeLatLng(lat, lng);
                    if (targetLatLng) {
                      naverMap.current.panTo(targetLatLng, {
                        duration: 1000,
                        easing: 'easeOutCubic'
                      });
                      naverMap.current.setZoom(16);
                    }
                  } else if (mapType === 'google' && map.current && window.google?.maps) {
                    map.current.panTo({ lat, lng });
                    map.current.setZoom(16);
                  }
                  
                  console.log('[fetchAllGroupData] 첫 번째 멤버 위치로 지도 이동:', firstMember.name, { lat, lng });
                }
              }
            }, 1000); // 지도 초기화와 마커 생성을 위한 충분한 지연
          }
          
          // 데이터 로딩 완료 햅틱 피드백
          triggerHapticFeedback(HapticFeedbackType.SUCCESS, '그룹 데이터 로딩 완료', { 
            component: 'home', 
            action: 'data-load-complete' 
          });
        }
      }
    };

    // selectedGroupId가 있고, 현재 그룹의 데이터가 아직 로드되지 않았을 때만 실행
    if (selectedGroupId && (
      dataFetchedRef.current.currentGroupId !== selectedGroupId || 
      !dataFetchedRef.current.members || 
      !dataFetchedRef.current.schedules
    )) {
      console.log('[useEffect] fetchAllGroupData 호출 조건 만족:', {
        selectedGroupId,
        currentGroupId: dataFetchedRef.current.currentGroupId,
        members: dataFetchedRef.current.members,
        schedules: dataFetchedRef.current.schedules,
        loading: dataFetchedRef.current.loading
      });
      fetchAllGroupData();
    } else {
      console.log('[useEffect] fetchAllGroupData 호출 조건 불만족 - 실행 건너뜀:', {
        selectedGroupId,
        currentGroupId: dataFetchedRef.current.currentGroupId,
        members: dataFetchedRef.current.members,
        schedules: dataFetchedRef.current.schedules,
        loading: dataFetchedRef.current.loading
      });
    }

    return () => { isMounted = false; };
  }, [selectedGroupId, authLoading, isPreloadingComplete]); // 캐시 함수들은 의존성에서 제거 (안정적인 참조 유지)

  // 컴포넌트 마운트 시 초기 지도 타입 설정
  useEffect(() => {
    // 네이버 지도를 기본으로 사용 (개발 환경에서도 네이버 지도 사용)
    setMapType('naver');
      }, []);
 
    // 컴포넌트 마운트 시 그룹 목록 불러오기
    // useEffect(() => {
    //   fetchUserGroups();
    // }, []); // UserContext로 대체되어 제거
  
    // 로그인 상태 확인 및 사용자 정보 초기화 (Google 로그인 동기화 개선)
  useEffect(() => {
    // 🚨 카카오 로그인 처리
    const processPendingKakaoLogin = async () => {
      try {
        const pendingLoginData = sessionStorage.getItem('pendingKakaoLogin');
        if (pendingLoginData) {
          console.log('[HOME] 대기 중인 카카오 로그인 데이터 발견');
          
          const loginData = JSON.parse(pendingLoginData);
          
          // sessionStorage에서 제거
          sessionStorage.removeItem('pendingKakaoLogin');
          
          // 백엔드 API 호출
          const response = await fetch('/api/kakao-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: loginData.accessToken,
              userInfo: loginData.userInfo,
              source: 'native'
            }),
          });

          const data = await response.json();
          
          console.log('[HOME] 카카오 인증 API 응답:', {
            success: data.success,
            isNewUser: data.isNewUser
          });

          if (data.success) {
            if (data.isNewUser) {
              console.log('[HOME] 신규회원 - 회원가입 페이지로 리다이렉트');
              
              // 소셜 로그인 데이터 저장
              if (data.socialLoginData) {
                sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
              }
              
              window.location.href = '/register?social=kakao';
              return; // 함수 종료
            } else {
              console.log('[HOME] 기존회원 - 로그인 완료');
              // 페이지를 새로고침하여 로그인 상태 반영
              console.log('[HOME] 카카오 로그인 후 페이지 새로고침');
              window.location.reload();
            }
          } else {
            console.error('[HOME] 카카오 인증 실패:', data.error);
            alert(data.error || '카카오 로그인에 실패했습니다.');
            window.location.href = '/signin';
            return; // 함수 종료
          }
        }
      } catch (error) {
        console.error('[HOME] 카카오 로그인 처리 실패:', error);
      }
    };

    const initializeUserAuth = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) {
        console.log('[HOME] 인증 로딩 중...');
        return;
      }

      console.log('[HOME] 인증 상태 확인:', { isLoggedIn, user: user?.mt_idx });

      // 추가 인증 상태 확인 (localStorage 직접 확인)
      const hasToken = authService.getToken();
      const hasUserData = authService.getUserData();
      
      console.log('[HOME] 인증 데이터 상세 확인:', {
        authContextLoggedIn: isLoggedIn,
        hasToken: !!hasToken,
        hasUserData: !!hasUserData,
        contextUser: user?.mt_idx,
        localUser: hasUserData?.mt_idx
      });

      // 🔥 Google 로그인 직후 상태 확인 - 3초간 여유 시간 제공
      if (!isLoggedIn && (hasToken || hasUserData)) {
        console.log('[HOME] 🔄 Google 로그인 후 AuthContext 동기화 대기 중...');
        
        // 최대 3초까지 AuthContext 동기화 대기
        const maxWaitTime = 3000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms마다 체크
          
          // AuthContext가 동기화되었는지 다시 확인
          if (user?.mt_idx) {
            console.log('[HOME] ✅ AuthContext 동기화 완료 감지:', user.mt_idx);
            break;
          }
        }
        
        // 동기화 대기 완료 후 다시 상태 확인
        const finalUser = user || hasUserData;
        if (finalUser) {
          console.log('[HOME] 🎉 Google 로그인 인증 완료:', finalUser.mt_name);
          // 사용자 정보 초기화는 아래에서 처리
        } else {
          console.log('[HOME] ⚠️ 동기화 대기 후에도 사용자 정보 없음 - 로그인 필요');
          router.push('/signin');
          return;
        }
      }
      
      // 🔥 더 관대한 인증 체크 (페이지 간 이동 시 세션 유지)
      
      // 1. 쿠키에서도 토큰 확인
      let hasCookieToken = false;
      if (typeof window !== 'undefined') {
        const cookieToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token=') || row.startsWith('client-token='))
          ?.split('=')[1];
        hasCookieToken = !!cookieToken;
        
        console.log('[HOME] 🔍 인증 상태 완전 체크:', {
          authContextLoggedIn: isLoggedIn,
          hasLocalStorageToken: !!hasToken,
          hasLocalStorageUser: !!hasUserData,
          hasCookieToken,
          totalAuthSources: [isLoggedIn, !!hasToken, !!hasUserData, hasCookieToken].filter(Boolean).length
        });
      }
      
      // 2. 모든 인증 소스가 없을 때만 리다이렉트 (더 관대한 정책)
      if (!isLoggedIn && !hasToken && !hasUserData && !hasCookieToken) {
        console.log('[HOME] ❌ 완전히 로그인되지 않음 - signin 페이지로 리다이렉트');
        router.push('/signin');
        return;
      }
      
      // 3. 하나라도 인증 정보가 있으면 계속 진행 (세션 유지 우선)
      if (!isLoggedIn && (hasToken || hasUserData || hasCookieToken)) {
        console.log('[HOME] ⚡ AuthContext 미동기화 상태지만 계속 진행', {
          hasToken: !!hasToken,
          hasUserData: !!hasUserData,
          hasCookieToken,
          action: 'continue_without_redirect'
        });
        
                 // 백그라운드에서 동기화 시도 (사용자 방해 없이)
         try {
           // AuthContext의 refreshAuthState 함수 호출 시도
           const authContext = typeof window !== 'undefined' ? (window as any).__authContext__ : null;
           if (authContext?.refreshAuthState) {
             authContext.refreshAuthState().catch((error: any) => {
               console.warn('[HOME] 백그라운드 AuthContext 동기화 실패:', error);
             });
           }
         } catch (error) {
           console.warn('[HOME] AuthContext 접근 실패:', error);
         }
      }

              // 사용자 정보가 있는 경우 초기화 (AuthContext 또는 localStorage에서)
        const currentUser = user || hasUserData;
        if (currentUser) {
          setUserName(currentUser.mt_name || '사용자');

          // 사용자 위치 정보 설정
          if (currentUser.mt_lat && currentUser.mt_long) {
            const lat = typeof currentUser.mt_lat === 'number' ? currentUser.mt_lat : parseFloat(String(currentUser.mt_lat));
            const lng = typeof currentUser.mt_long === 'number' ? currentUser.mt_long : parseFloat(String(currentUser.mt_long));
            setUserLocation({ lat, lng });
          }

          // 사용자 지역 정보 설정
          if (currentUser.mt_sido) {
            setLocationName(currentUser.mt_sido + (currentUser.mt_gu ? ' ' + currentUser.mt_gu : ''));
          }

          // 🔥 localStorage에서 그룹 데이터 확인 및 초기화
          if (typeof window !== 'undefined') {
            try {
              const storedGroups = localStorage.getItem('user_groups');
              const groupCount = localStorage.getItem('user_group_count');
              
              if (storedGroups) {
                const groups = JSON.parse(storedGroups);
                if (groups && safeArrayCheck(groups) && groups.length > 0) {
                  console.log('[HOME] 🔥 localStorage에서 그룹 데이터 발견:', groups.length, '개');
                  
                  // UserContext와 동기화되지 않은 경우 직접 데이터 사용
                  if (userGroups.length === 0) {
                    console.log('[HOME] UserContext 빈 상태 - localStorage 그룹 데이터로 직접 초기화');
                    // 여기서 그룹 데이터를 직접 설정하는 대신 로그만 남김
                    // 실제 그룹 설정은 UserContext에서 처리되어야 함
                  }
                  
                  console.log('[HOME] localStorage 그룹 상세:', {
                    groups: (groups && safeArrayCheck(groups)) ? groups.map((g: any) => ({
                      sgt_idx: g.sgt_idx,
                      sgt_title: g.sgt_title,
                      member_count: g.member_count || g.memberCount || '미지정'
                    })) : [],
                    totalCount: parseInt(groupCount || '0')
                  });
                }
              }
            } catch (error) {
              console.warn('[HOME] localStorage 그룹 데이터 파싱 실패:', error);
            }
          }

          console.log('[HOME] 사용자 정보 초기화 완료:', {
            mt_idx: currentUser.mt_idx,
            name: currentUser.mt_name,
            location: { lat: currentUser.mt_lat, lng: currentUser.mt_long },
            source: user ? 'AuthContext' : 'localStorage',
            hasGroups: !!currentUser.groups?.length,
            userContextGroups: userGroups.length
          });
        }
    };

    // 먼저 카카오 로그인 처리, 그 다음 일반 인증 처리
    const runAuthSequence = async () => {
      await processPendingKakaoLogin();
      await initializeUserAuth();
    };

    runAuthSequence();
  }, [authLoading, isLoggedIn, user, router]);

  // 🗺️ 지도 API 로딩 및 초기화 - 컴포넌트 마운트 시 시작
  useEffect(() => {
    console.log('[HOME] 🗺️ 지도 초기화 시작 - 재방문 시에도 안전하게 처리');
    
    // 페이지 재방문 시에도 지도가 제대로 표시되도록 강제 초기화
    const forceMapInitialization = () => {
      // API 로드 상태 재검증
      const isNaverReady = window.naver?.maps && naverMapsLoaded;
      const isGoogleReady = window.google?.maps && googleMapsLoaded;
      
      if (mapType === 'naver') {
        if (isNaverReady) {
          console.log('[HOME] 네이버맵 API 이미 준비됨 - 즉시 초기화');
          setNaverMapsLoaded(true);
          apiLoadStatus.naver = true;
          setIsMapLoading(false);
        } else if (!apiLoadStatus.naver) {
          console.log('[HOME] 🗺️ 네이버맵 우선 로딩 시작');
          loadNaverMapsAPI();
        }
      } else if (mapType === 'google') {
        if (isGoogleReady) {
          console.log('[HOME] 구글맵 API 이미 준비됨 - 즉시 초기화');
          setGoogleMapsLoaded(true);
          apiLoadStatus.google = true;
          setIsMapLoading(false);
        } else if (!apiLoadStatus.google) {
          console.log('[HOME] 🗺️ 구글맵 로딩 시작');
          loadGoogleMapsAPI();
        }
      }
    };

    // 즉시 실행 및 약간의 지연 후 재실행 (페이지 전환 후 상태 안정화 대기)
    forceMapInitialization();
    const initTimeout = setTimeout(forceMapInitialization, 500);
    
    return () => clearTimeout(initTimeout);
  }, [mapType]); // mapType 변경 시에도 재실행

  // 🗺️ 지도 API 로드 완료 시 자동 초기화
  useEffect(() => {
    if (mapType === 'naver' && naverMapsLoaded && window.naver?.maps) {
      console.log('[HOME] 네이버맵 API 로드 완료 - 자동 초기화');
      setTimeout(() => initNaverMap(), 100); // DOM 안정화 대기
    }
  }, [naverMapsLoaded, mapType]);

  useEffect(() => {
    if (mapType === 'google' && googleMapsLoaded && window.google?.maps) {
      console.log('[HOME] 구글맵 API 로드 완료 - 자동 초기화');
      setTimeout(() => initGoogleMap(), 100); // DOM 안정화 대기
    }
  }, [googleMapsLoaded, mapType]);

  // 🗺️ 그룹멤버 데이터 변경 시 지도 업데이트
  useEffect(() => {
    if (groupMembers.length > 0) {
      console.log('[HOME] 그룹멤버 데이터 변경 - 지도 업데이트');
      if (mapType === 'naver' && naverMapsLoaded && naverMap.current && window.naver?.maps?.LatLng) {
        // 네이버맵 업데이트
        const firstMember = groupMembers[0];
        const lat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat) || userLocation.lat;
        const lng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng) || userLocation.lng;
        try {
          const latlng = new window.naver.maps.LatLng(lat, lng);
          naverMap.current.setCenter(latlng);
          if (naverMarker.current) {
            naverMarker.current.setPosition(latlng);
          }
        } catch (error) {
          console.error('[HOME] 네이버 지도 위치 업데이트 실패:', error);
        }
      } else if (mapType === 'google' && googleMapsLoaded && map.current) {
        // 구글맵 업데이트
        const firstMember = groupMembers[0];
        const lat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat) || userLocation.lat;
        const lng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng) || userLocation.lng;
        const centerLocation = { lat, lng };
        map.current.setCenter(centerLocation);
        if (marker.current) {
          marker.current.setPosition(centerLocation);
        }
      }
    }
  }, [groupMembers, mapType]);

  // 🧹 컴포넌트 언마운트 시 지도 상태 정리
  useEffect(() => {
    return () => {
      console.log('[HOME] 컴포넌트 언마운트 - 지도 상태 정리');
      
      // 지도 인스턴스 정리
      if (map.current) {
        map.current = null;
      }
      if (naverMap.current) {
        naverMap.current = null;
      }
      if (marker.current) {
        marker.current = null;
      }
      if (naverMarker.current) {
        naverMarker.current = null;
      }
      
      // 로딩 상태 초기화
      setIsMapLoading(false);
      setMapsInitialized({ naver: false, google: false });
      
      // API 로드 상태는 유지 (재방문 시 빠른 로딩을 위해)
      console.log('[HOME] 지도 상태 정리 완료 - API 로드 상태는 유지');
    };
  }, []); // 컴포넌트 마운트 시 한 번만 등록

  // Google Maps API 로드 함수 (프리로딩 최적화)
  const loadGoogleMapsAPI = async () => {
    // 이미 로드된 경우 중복 로드 방지
    if (apiLoadStatus.google || window.google?.maps) {
      console.log('[HOME] 🚀 Google Maps API 프리로딩 완료 - 즉시 사용 가능');
      setGoogleMapsLoaded(true);
      apiLoadStatus.google = true;
      setIsMapLoading(false); // 프리로드 완료시 즉시 로딩 상태 해제
      return;
    }

    // 프리로드된 스크립트가 있는지 확인
    const preloadedScript = (typeof document !== 'undefined') ? document.getElementById('google-maps-preload') : null;
    if (preloadedScript) {
      console.log('[HOME] 프리로드된 구글 지도 스크립트 발견 - 로드 완료 대기');
      // 프리로드된 스크립트가 완료될 때까지 짧은 간격으로 체크
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          console.log('[HOME] 프리로드된 Google Maps API 로드 완료');
          clearInterval(checkInterval);
          apiLoadStatus.google = true;
          setGoogleMapsLoaded(true);
          setIsMapLoading(false);
        }
      }, 50);
      
      // 최대 3초 대기 후 백업 로딩
      setTimeout(() => {
        if (!window.google?.maps) {
          clearInterval(checkInterval);
          console.log('[HOME] 구글 지도 프리로드 대기 시간 초과 - 백업 로딩 실행');
          performGoogleBackupLoading();
        }
      }, 3000);
      return;
    }

    // 프리로드가 없을 경우 즉시 백업 로딩
    console.log('[HOME] 프리로드 스크립트 없음 - Google Maps 백업 로딩 시작');
    performGoogleBackupLoading();

    async function performGoogleBackupLoading() {
      try {
        console.log('[HOME] Google Maps API 백업 로드 시작');
        // Loader를 사용하여 비동기적으로 API 로드
        await googleMapsLoader.load();
        console.log('[HOME] Google Maps API 백업 로드 성공');
        apiLoadStatus.google = true;
        setGoogleMapsLoaded(true);
        setIsMapLoading(false);
      } catch (error) {
        console.error('[HOME] Google Maps API 백업 로드 실패:', error);
        setIsMapLoading(false);
        // 구글맵 로드 실패 시에도 네이버맵을 유지 (이미 기본값이 naver)
      }
    }
  };

  // Naver Maps API 로드 함수 (프리로딩 최적화 + iOS WebView 지원)
  const loadNaverMapsAPI = () => {
    // iOS WebView 감지
    const isIOSWebView = typeof window !== 'undefined' && 
                        window.webkit && 
                        window.webkit.messageHandlers;

    // 이미 로드된 경우 중복 로드 방지
    if (apiLoadStatus.naver || window.naver?.maps) {
      console.log('[HOME] 🚀 Naver Maps API 프리로딩 완료 - 즉시 사용 가능');
      setNaverMapsLoaded(true);
      apiLoadStatus.naver = true;
      setIsMapLoading(false); // 프리로드 완료시 즉시 로딩 상태 해제
      return;
    }

    if (isIOSWebView) {
      console.log('[HOME] iOS WebView 환경 - 네이버 지도 최적화 로딩');
      // iOS WebView에서는 ios-webview-fix.js의 최적화를 기다림
      // 스크립트가 이미 있는지 확인
      const existingScript = (typeof document !== 'undefined') ? document.querySelector('script[src*="oapi.map.naver.com"]') : null;
      if (!existingScript) {
        // 스크립트가 없으면 생성
        performBackupLoading();
      } else {
        console.log('[HOME] iOS WebView - 네이버 지도 스크립트 발견, 최적화 대기');
        // ios-webview-fix.js에서 naverMapsReady 이벤트를 발생시킬 때까지 대기
      }
      return;
    }

    console.log('[HOME] Naver Maps API 프리로딩 대기 중 - 백업 로딩 확인');
    
    // 프리로드된 스크립트가 있는지 확인
    const preloadedScript = (typeof document !== 'undefined') ? document.getElementById('naver-maps-preload') : null;
    if (preloadedScript) {
      console.log('[HOME] 프리로드된 네이버 지도 스크립트 발견 - 로드 완료 대기');
      // 프리로드된 스크립트가 완료될 때까지 짧은 간격으로 체크
      const checkInterval = setInterval(() => {
        if (window.naver?.maps) {
          console.log('[HOME] 프리로드된 Naver Maps API 로드 완료');
          clearInterval(checkInterval);
          apiLoadStatus.naver = true;
          setNaverMapsLoaded(true);
          setIsMapLoading(false);
        }
      }, 50); // 50ms마다 체크
      
      // 최대 3초 대기 후 백업 로딩
      setTimeout(() => {
        if (!window.naver?.maps) {
          clearInterval(checkInterval);
          console.log('[HOME] 프리로드 대기 시간 초과 - 백업 로딩 실행');
          performBackupLoading();
        }
      }, 3000);
      return;
    }

    // 프리로드가 없을 경우 즉시 백업 로딩
    console.log('[HOME] 프리로드 스크립트 없음 - 백업 로딩 시작');
    performBackupLoading();

    function performBackupLoading() {
      // 동적 Client ID 가져오기 (도메인별 자동 선택)
      const dynamicClientId = API_KEYS.NAVER_MAPS_CLIENT_ID;
      console.log(`🗺️ [HOME] 네이버 지도 Client ID 사용: ${dynamicClientId}`);
      
      // 네이버 지도 API 로드용 URL 생성 (올바른 파라미터명 사용)
      const naverMapUrl = new URL(`https://oapi.map.naver.com/openapi/v3/maps.js`);
      naverMapUrl.searchParams.append('ncpKeyId', dynamicClientId); // 동적 Client ID 사용
      
      // 프로덕션 환경에서는 서브모듈 최소화 (로딩 속도 최적화)
      const isProduction = window.location.hostname.includes('.smap.site');
      if (!isIOSWebView && !isProduction) {
        // 개발 환경에서만 전체 서브모듈 로드
        naverMapUrl.searchParams.append('submodules', 'geocoder,drawing,visualization');
      } else if (!isIOSWebView && isProduction) {
        // 프로덕션에서는 필수 모듈만 로드 (빠른 초기화)
        naverMapUrl.searchParams.append('submodules', 'geocoder');
      }
      
      // script 요소 생성 및 로드
      const script = document.createElement('script');
      script.src = naverMapUrl.toString();
      script.async = true;
      script.defer = true;
      script.id = 'naver-maps-backup';
      
      // 네이버 지도 로딩 에러 감지 및 처리
      let hasErrorOccurred = false;
      let errorListener: any = null;
      
      // 전역 에러 리스너 추가 (401, 500 오류 감지)
      const handleNaverMapsError = (event: ErrorEvent) => {
        const errorMessage = event.message || '';
        const isNaverError = errorMessage.includes('naver') || 
                           errorMessage.includes('maps') ||
                           errorMessage.includes('oapi.map.naver.com') ||
                           errorMessage.includes('Unauthorized') ||
                           errorMessage.includes('Internal Server Error');
        
        if (isNaverError && !hasErrorOccurred) {
          hasErrorOccurred = true;
          console.error('[HOME] 네이버 지도 API 인증/서버 오류 감지:', errorMessage);
          
          // 구글맵으로 전환하지 않고 네이버맵 재시도
          setIsMapLoading(false);
          setNaverMapsLoaded(false);
          
          // 네이버맵 재시도
          setTimeout(() => {
            console.log('[HOME] 네이버 지도 오류 후 재시도...');
            loadNaverMapsAPI();
          }, 5000);
          
          // 에러 리스너 제거
          if (errorListener) {
            window.removeEventListener('error', errorListener);
            errorListener = null;
          }
        }
      };
      
      // 에러 리스너 등록
      errorListener = handleNaverMapsError;
      window.addEventListener('error', errorListener);
      
      script.onload = () => {
        console.log('[HOME] Naver Maps API 백업 로드 성공');
        
        // 로드 성공 후에도 API 호출 오류가 발생할 수 있으므로 일정 시간 동안 에러 감지
        setTimeout(() => {
          if (errorListener && !hasErrorOccurred) {
            window.removeEventListener('error', errorListener);
            errorListener = null;
          }
        }, 5000); // 5초 후 에러 리스너 제거
        
        if (isIOSWebView) {
          console.log('[HOME] iOS WebView - 네이버 지도 스크립트 로드 완료, 최적화 대기');
          // iOS WebView에서는 ios-webview-fix.js의 최적화를 기다림
        } else {
          // 일반 브라우저에서는 즉시 설정
          if (!hasErrorOccurred) {
            apiLoadStatus.naver = true;
            setNaverMapsLoaded(true);
            setIsMapLoading(false);
          }
        }
      };
      
      script.onerror = () => {
        console.error('[HOME] 네이버 지도 백업 로드 실패 - 재시도 중...');
        hasErrorOccurred = true;
        setIsMapLoading(false);
        
        // 네이버맵 로딩 재시도 (구글맵으로 전환하지 않음)
        setTimeout(() => {
          if (!naverMapsLoaded) {
            console.log('[HOME] 네이버맵 재시도 중...');
            loadNaverMapsAPI();
          }
        }, 2000);
        
        // 에러 리스너 제거
        if (errorListener) {
          window.removeEventListener('error', errorListener);
          errorListener = null;
        }
      };
      
      // 중복 로드 방지를 위해 기존 스크립트 제거
      const existingScript = document.getElementById('naver-maps-backup');
      if (existingScript) {
        existingScript.remove();
      }
      
      document.head.appendChild(script);
      
      // iOS WebView에서는 더 긴 타임아웃 설정 (15초)
      const timeout = isIOSWebView ? 15000 : 10000;
      setTimeout(() => {
        if (!naverMapsLoaded && !hasErrorOccurred) {
          console.warn(`[HOME] 네이버 지도 로딩 타임아웃 (${timeout}ms) - 재시도 중...`);
          hasErrorOccurred = true;
          
          // 네이버맵 재시도 (구글맵으로 전환하지 않음)
          setTimeout(() => {
            if (!naverMapsLoaded) {
              console.log('[HOME] 네이버맵 타임아웃 후 재시도...');
              loadNaverMapsAPI();
            }
          }, 3000);
          
          // 에러 리스너 제거
          if (errorListener) {
            window.removeEventListener('error', errorListener);
            errorListener = null;
          }
        }
      }, timeout);
    }
  };

  // Google 지도 초기화 (로고 제거 옵션 추가)
  const initGoogleMap = () => {
    if (!googleMapContainer.current || !googleMapsLoaded || !window.google || !window.google.maps) {
      console.log('Google Maps 초기화를 위한 조건이 충족되지 않음');
      return;
    }

    // 그룹멤버가 있으면 첫 번째 멤버 위치, 없으면 현재 위치로 초기화
    let centerLocation = { lat: userLocation.lat, lng: userLocation.lng };
    let locationName = '현재 위치';
    
    if (groupMembers.length > 0) {
      const firstMember = groupMembers[0];
      const centerLat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat) || userLocation.lat;
      const centerLng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng) || userLocation.lng;
      centerLocation = { lat: centerLat, lng: centerLng };
      locationName = `${firstMember.name} 위치`;
    } else {
      console.log('Google Maps 초기화: 그룹멤버 데이터 없음 - 현재 위치 사용');
    }

    try {
      // 기존 구글 지도 인스턴스가 있으면 마커만 업데이트
      if (map.current) {
        map.current.setCenter(centerLocation);
        if (marker.current) {
          marker.current.setPosition(centerLocation);
        }
        console.log('Google Maps 기존 인스턴스 업데이트:', locationName, centerLocation);
        return;
      }
      
      console.log('Google Maps 초기화 시작');
      setIsMapLoading(true);
      
      console.log('Google Maps 초기화 - 중심 위치:', locationName, centerLocation);
      
      // 지도 생성
      const mapOptions = {
        ...MAP_CONFIG.GOOGLE.DEFAULT_OPTIONS,
        center: centerLocation,
        zoom: 16, // 적절한 확대 레벨
        // 로고 및 UI 컨트롤 숨김 옵션 추가
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      };
      
      map.current = new window.google.maps.Map(googleMapContainer.current, mapOptions);

      // 마커는 그룹 멤버 데이터 로딩 후 생성 (초기 마커 생성 제거)
      console.log('Google Maps 초기화 완료 - 마커는 그룹 멤버 데이터 로딩 후 생성');

      // 지도 로딩 완료
      window.google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
        setIsMapLoading(false);
        setMapsInitialized(prev => ({...prev, google: true}));
        console.log('Google Maps 타일 로딩 완료');
      });
      
      // iOS WebView에서 구글 지도 로딩 타임아웃 설정 (15초)
      const googleMapTimeout = setTimeout(() => {
        if (isMapLoading) {
          console.warn('Google Maps 로딩 타임아웃');
          setIsMapLoading(false);
          setMapsInitialized(prev => ({...prev, google: true}));
        }
      }, 15000);
      
      console.log('Google Maps 초기화 완료');
    } catch (error) {
      console.error('Google Maps 초기화 오류:', error);
      setIsMapLoading(false);
    }
  };

  // Naver 지도 초기화
  const initNaverMap = () => {
    if (!naverMapContainer.current || !naverMapsLoaded || !window.naver || !window.naver.maps) {
      console.log('Naver Maps 초기화를 위한 조건이 충족되지 않음');
      
      // iOS WebView에서 네이버맵 로딩 재시도
      if ((window as any).webkit && (window as any).webkit.messageHandlers) {
        console.log('iOS WebView에서 Naver Maps 로딩 재시도');
        setTimeout(() => {
          loadNaverMapsAPI();
        }, 2000);
      }
      return;
    }

    // 그룹멤버가 있으면 첫 번째 멤버 위치, 없으면 현재 위치로 초기화
    let centerLat = userLocation.lat;
    let centerLng = userLocation.lng;
    let locationName = '현재 위치';
    
    if (groupMembers.length > 0) {
      const firstMember = groupMembers[0];
      centerLat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat) || userLocation.lat;
      centerLng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng) || userLocation.lng;
      locationName = `${firstMember.name} 위치`;
    } else {
      console.log('Naver Maps 초기화: 그룹멤버 데이터 없음 - 현재 위치 사용');
    }

    try {
      // 기존 네이버 지도 인스턴스가 있으면 마커만 업데이트
      if (naverMap.current && window.naver?.maps?.LatLng) {
        try {
          const latlng = new window.naver.maps.LatLng(centerLat, centerLng);
          naverMap.current.setCenter(latlng);
          if (naverMarker.current) {
            naverMarker.current.setPosition(latlng);
          }
          console.log('Naver Maps 기존 인스턴스 업데이트:', locationName, centerLat, centerLng);
          return;
        } catch (error) {
          console.error('[HOME] 네이버 지도 인스턴스 업데이트 실패:', error);
          return;
        }
      }
      
      console.log('Naver Maps 초기화 시작');
      setIsMapLoading(true);

      // 현재 URL 확인 및 로깅 (디버깅용)
      const currentDomain = window.location.hostname;
      const currentPort = window.location.port;
      const currentUrl = `${currentDomain}${currentPort ? ':'+currentPort : ''}`;
      console.log(`현재 도메인: ${currentUrl}`);
      console.log(`네이버 지도 허용 도메인 목록:`, MAP_CONFIG.NAVER.ALLOWED_DOMAINS);

      // 인증 상태 확인 변수
      let authFailed = false;

      // Naver Maps 인증 오류 처리 리스너 추가
      const errorListener = window.naver.maps.Event.addListener(window.naver.maps, 'auth_failure', function(error: any) {
        authFailed = true; // 인증 실패 표시
        console.error('네이버 지도 인증 실패:', error);
        console.error(`현재 URL(${window.location.href})이 네이버 지도 API에 등록되어 있는지 확인하세요.`);
        console.error('네이버 클라우드 플랫폼 콘솔에서 "Application > Maps > Web 호스팅 URL"에 현재 도메인을 추가해야 합니다.');
        setIsMapLoading(false);
      });

      try {
        console.log('Naver Maps 초기화 - 중심 위치:', locationName, centerLat, centerLng);
        
        // 지도 옵션에 MAP_CONFIG의 기본 설정 사용 + 로고 및 저작권 표시 숨김
        if (!window.naver?.maps?.LatLng) {
          console.error('[HOME] Naver Maps API가 완전히 로드되지 않음');
          setIsMapLoading(false);
          return;
        }
        
        const mapOptions = {
          ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
          center: new window.naver.maps.LatLng(centerLat, centerLng),
          zoom: 16, // 적절한 확대 레벨
          // 로고 및 저작권 정보 비표시 옵션 추가
          logoControl: false,
          logoControlOptions: {
            position: window.naver.maps.Position.BOTTOM_LEFT
          },
          mapDataControl: false,
          scaleControl: false,
          mapTypeControl: false
        };
        
        naverMap.current = new window.naver.maps.Map(naverMapContainer.current, mapOptions);
        
        // 지도가 로드된 후 초기화 완료 처리 (마커는 그룹 멤버 데이터에 따라 나중에 생성)
        const initListener = window.naver.maps.Event.addListener(naverMap.current, 'init', () => {
          if (!authFailed && naverMap.current) {
            console.log('Naver Maps 초기화 완료 - 마커는 그룹 멤버 데이터 로딩 후 생성');
          }
          
          setIsMapLoading(false);
          setMapsInitialized(prev => ({...prev, naver: true}));
          console.log('Naver Maps 초기화 완료');
          
          // 인증 오류 리스너 제거
          window.naver.maps.Event.removeListener(errorListener);
          window.naver.maps.Event.removeListener(initListener);
        });
        
        // iOS WebView에서 지도 로딩 타임아웃 설정 (10초)
        const mapLoadTimeout = setTimeout(() => {
          if (isMapLoading) {
            console.warn('Naver Maps 로딩 타임아웃, Google Maps로 전환');
            setIsMapLoading(false);
            window.naver.maps.Event.removeListener(errorListener);
            window.naver.maps.Event.removeListener(initListener);
            
            // 구글 지도로 전환
            setMapType('google');
            if (!apiLoadStatus.google) {
              loadGoogleMapsAPI();
            }
          }
        }, 10000);
      } catch (innerError) {
        console.error('Naver Maps 객체 생성 오류:', innerError);
        window.naver.maps.Event.removeListener(errorListener);
        setIsMapLoading(false);
      }
      
    } catch (error) {
      console.error('Naver Maps 초기화 오류:', error);
      setIsMapLoading(false);
    }
  };

  // 지도 API 로드 관리
  useEffect(() => {
    // 네이버 지도 API를 우선적으로 로드
    if (mapType === 'naver' && !apiLoadStatus.naver) {
      loadNaverMapsAPI();
    } else if (mapType === 'google' && !apiLoadStatus.google) {
      loadGoogleMapsAPI();
    }
    
    // 이미 로드된 API가 있으면 즉시 로딩 상태 해제
    if ((mapType === 'naver' && naverMapsLoaded) || (mapType === 'google' && googleMapsLoaded)) {
      console.log(`[HOME] ${mapType} 지도가 이미 로드됨 - 로딩 상태 해제`);
      setIsMapLoading(false);
    }
  }, [mapType, naverMapsLoaded, googleMapsLoaded]);

  // iOS WebView에서 지도 폴백 이벤트 리스너
  useEffect(() => {
    const handleMapTypeFallback = (event: CustomEvent) => {
      console.log('Map type fallback event received:', event.detail);
      if (event.detail.from === 'naver' && event.detail.to === 'google') {
        console.log('네이버맵 인증 실패 - 네이버맵 재시도');
        // 구글맵으로 전환하지 않고 네이버맵 재시도
        setTimeout(() => {
          loadNaverMapsAPI();
        }, 3000);
      }
    };

    // iOS WebView 전용 네이버 지도 폴백 이벤트 리스너
    const handleNaverMapsFallback = (event: CustomEvent) => {
      console.log('[iOS WebView] Naver Maps fallback event:', event.detail);
      
      // 네이버 지도 로딩 실패 시 재시도 (구글맵으로 전환하지 않음)
      if (event.detail.reason) {
        console.log(`[iOS WebView] Naver Maps failed: ${event.detail.reason}, 재시도 중...`);
        setNaverMapsLoaded(false);
        
        // 네이버맵 재시도
        setTimeout(() => {
          console.log('[iOS WebView] 네이버맵 재시도 중...');
          loadNaverMapsAPI();
        }, 3000);
      }
    };

    // iOS WebView 전용 네이버 지도 준비 완료 이벤트 리스너
    const handleNaverMapsReady = (event: CustomEvent) => {
      console.log('[iOS WebView] Naver Maps ready event:', event.detail);
      
      if (event.detail.source === 'ios-webview-fix') {
        console.log('[iOS WebView] Naver Maps optimized and ready');
        setNaverMapsLoaded(true);
        
        // 네이버 지도 초기화
        setTimeout(() => {
          if (mapType === 'naver') {
            initNaverMap();
          }
        }, 500);
      }
    };

    // iOS WebView 전용 구글 지도 준비 완료 이벤트 리스너
    const handleGoogleMapsReady = (event: CustomEvent) => {
      console.log('[iOS WebView] Google Maps ready event:', event.detail);
      
      if (event.detail.source === 'ios-webview-fix') {
        console.log('[iOS WebView] Google Maps optimized and ready');
        setGoogleMapsLoaded(true);
        
        // 구글 지도 초기화
        setTimeout(() => {
          if (mapType === 'google') {
            initGoogleMap();
          }
        }, 500);
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener('mapTypeFallback', handleMapTypeFallback as EventListener);
    document.addEventListener('mapFallbackToGoogle', handleNaverMapsFallback as EventListener);
    document.addEventListener('naverMapsReady', handleNaverMapsReady as EventListener);
    document.addEventListener('googleMapsReady', handleGoogleMapsReady as EventListener);
    
    return () => {
      document.removeEventListener('mapTypeFallback', handleMapTypeFallback as EventListener);
      document.removeEventListener('mapFallbackToGoogle', handleNaverMapsFallback as EventListener);
      document.removeEventListener('naverMapsReady', handleNaverMapsReady as EventListener);
      document.removeEventListener('googleMapsReady', handleGoogleMapsReady as EventListener);
    };
  }, [mapType, googleMapsLoaded]);

  // 지도 타입 변경 & 지도 업데이트
  useEffect(() => {
    // 컴포넌트 마운트 시 또는 지도 타입 변경 시 지도 초기화
    if (mapType === 'naver' && naverMapsLoaded) {
      // 네이버 맵 표시, 구글 맵 숨김
      if (googleMapContainer.current) googleMapContainer.current.style.display = 'none';
      if (naverMapContainer.current) naverMapContainer.current.style.display = 'block';
      
      // 구글 지도 리소스 정리
      cleanupGoogleMap(map, marker);
      
      initNaverMap();
    } else if (mapType === 'google' && googleMapsLoaded) {
      // 구글 맵 표시, 네이버 맵 숨김
      if (googleMapContainer.current) googleMapContainer.current.style.display = 'block';
      if (naverMapContainer.current) naverMapContainer.current.style.display = 'none';
      
      // 네이버 지도 리소스 정리
      cleanupNaverMap(naverMap, naverMarker);
      
      initGoogleMap();
    }
  }, [userLocation, mapType, googleMapsLoaded, naverMapsLoaded, groupMembers]);
  
  // 지도 로딩 상태 강제 완료 처리 (사용자 경험 개선)
  useEffect(() => {
    // 3초 후 지도 로딩 상태를 강제로 완료 처리
    const forceCompleteTimeout = setTimeout(() => {
      if (isMapLoading) {
        console.log('[HOME] 지도 로딩 타임아웃 - 강제 완료 처리 (UX 개선)');
        setIsMapLoading(false);
      }
    }, 3000);

    return () => clearTimeout(forceCompleteTimeout);
  }, [isMapLoading]);

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      // 네이버 맵 리소스 정리
      cleanupNaverMap(naverMap, naverMarker);
      
      // 구글 맵 리소스 정리
      cleanupGoogleMap(map, marker);
      
      // 네이버 지도 스크립트 제거
      const naverScript = document.getElementById('naver-maps-script');
      if (naverScript) document.head.removeChild(naverScript);
      
      // API 로드 상태 초기화
      apiLoadStatus.google = false;
      apiLoadStatus.naver = false;
    };
  }, []);

  // 첫 번째 멤버 자동 선택 - 중복 실행 방지 강화
  useEffect(() => {
    if (groupMembers && safeArrayCheck(groupMembers) && groupMembers.length > 0 && 
        !(groupMembers && safeArrayCheck(groupMembers) && groupMembers.some(m => m.isSelected)) && 
        !firstMemberSelected &&
        dataFetchedRef.current.members && 
        dataFetchedRef.current.schedules &&
        ((mapType === 'naver' && mapsInitialized.naver && naverMap.current) || 
         (mapType === 'google' && mapsInitialized.google && map.current))) {
      
      console.log('[HOME] 첫 번째 멤버 자동 선택 시작:', groupMembers[0].name);
      
      // 상태를 즉시 설정하여 중복 실행 방지
      setFirstMemberSelected(true);
      
      setTimeout(() => {
        // 다시 한 번 중복 체크
        if (groupMembers && safeArrayCheck(groupMembers) && !(groupMembers && safeArrayCheck(groupMembers) && groupMembers.some(m => m.isSelected))) {
          console.log('[HOME] 첫 번째 멤버 자동 선택 실행:', groupMembers[0].id);
          handleMemberSelect(groupMembers[0].id);
        } else {
          console.log('[HOME] 이미 멤버가 선택되어 있음, 자동 선택 건너뛰기');
      }
      }, 300);
    }
  }, [groupMembers?.length || 0, firstMemberSelected, dataFetchedRef.current.members, dataFetchedRef.current.schedules, mapsInitialized.naver, mapsInitialized.google, mapType]);

  // 공통 좌표 파싱 함수
  const parseCoordinate = (coord: any): number | null => {
    // console.log('[parseCoordinate] 입력:', { coord, type: typeof coord });
    // if (coord === null || coord === undefined) {
    //   console.log('[parseCoordinate] null/undefined 반환');
    //   return null;
    // }
    const num = parseFloat(coord);
    // console.log('[parseCoordinate] 변환 결과:', { num, isNaN: isNaN(num) });
    return isNaN(num) ? null : num;
  };

  // 안전한 LatLng 객체 생성 헬퍼 함수
  const createSafeLatLng = (lat: number, lng: number): any | null => {
    if (!window.naver?.maps?.LatLng) {
      console.error('[HOME] Naver Maps API가 로드되지 않음');
      return null;
    }
    try {
      return new window.naver.maps.LatLng(lat, lng);
    } catch (error) {
      console.error('[HOME] LatLng 객체 생성 실패:', error);
      return null;
    }
  };

  // 공통 마커 생성 함수 - 위치 페이지에서 가져온 개선된 로직
  const createMarker = (
    location: any,
    index: number,
    markerType: 'member' | 'schedule',
    isSelected?: boolean,
    memberData?: GroupMember,
    scheduleData?: Schedule
  ) => {
    // 좌표 안전성 검사
    let lat: number | null = null;
    let lng: number | null = null;

    // console.log('[createMarker] 시작:', { markerType, index, location, memberData: !!memberData, scheduleData: !!scheduleData });

    if (markerType === 'member' && memberData) {
      // WebKit 환경에서 실시간 GPS 위치(mlt_lat, mlt_long) 우선 사용
      const isWebKit = typeof window !== 'undefined' && (!!(window as any).webkit || navigator.userAgent.includes('WebKit'));
      
      // 실시간 GPS 위치를 우선 사용하고, 없으면 기본 위치 사용
      const realTimeLat = parseCoordinate(memberData.mlt_lat);
      const realTimeLng = parseCoordinate(memberData.mlt_long);
      const defaultLat = parseCoordinate(memberData.location.lat);
      const defaultLng = parseCoordinate(memberData.location.lng);
      
      lat = (realTimeLat !== null && realTimeLat !== 0) ? realTimeLat : defaultLat;
      lng = (realTimeLng !== null && realTimeLng !== 0) ? realTimeLng : defaultLng;
      
      console.log('[createMarker] 멤버 위치 선택:', { 
        memberName: memberData.name,
        isWebKit,
        'realTime GPS': { lat: realTimeLat, lng: realTimeLng, time: memberData.mlt_gps_time },
        'default location': { lat: defaultLat, lng: defaultLng },
        'selected': { lat, lng },
        usingRealTime: (realTimeLat !== null && realTimeLat !== 0),
        timeSinceLastGPS: memberData.mlt_gps_time ? Math.floor((new Date().getTime() - new Date(memberData.mlt_gps_time).getTime()) / 60000) + '분' : 'unknown'
      });
    } else if (markerType === 'schedule' && scheduleData) {
      // console.log('[createMarker] 스케줄 좌표 처리:', { 
      //   'scheduleData.sst_location_lat': scheduleData.sst_location_lat, 
      //   'scheduleData.sst_location_long': scheduleData.sst_location_long 
      // });
      lat = parseCoordinate(scheduleData.sst_location_lat);
      lng = parseCoordinate(scheduleData.sst_location_long);
    } else if (location) {
      // console.log('[createMarker] location 객체 좌표 처리:', { 
      //   'location.lat': location.lat, 
      //   'location.lng': location.lng 
      // });
      lat = parseCoordinate(location.lat);
      lng = parseCoordinate(location.lng);
    }

    console.log('[createMarker] 최종 좌표:', { lat, lng });

    if (lat === null || lng === null || lat === 0 || lng === 0) {
      console.error('[createMarker] 유효하지 않은 좌표:', { lat, lng });
      return null;
    }

    // 좌표 범위 검증 (한국 근처)
    if (lat < 33 || lat > 43 || lng < 124 || lng > 132) {
      console.warn('[createMarker] 한국 범위를 벗어난 좌표:', { lat, lng });
    }

    const validLat = lat;
    const validLng = lng;

    // console.log('[createMarker] 검증된 좌표:', { validLat, validLng });

    if (mapType === 'naver' && naverMap.current && window.naver?.maps) {
      const naverPos = createSafeLatLng(validLat, validLng);
      if (!naverPos) {
        console.error('[createMarker] LatLng 객체 생성 실패');
        return null;
      }
      
      if (markerType === 'member' && memberData) {
        // 안전한 이미지 URL 사용
        const photoForMarker = getSafeImageUrl(memberData.photo, memberData.mt_gender, memberData.original_index);
        // 선택 상태에 따른 테두리 색상 설정 - 빨간색으로 변경
        const borderColor = isSelected ? '#EC4899' : '#4F46E5'; // 선택시 핑크, 기본은 인디고
        
        const newMarker = new window.naver.maps.Marker({
          position: naverPos,
          map: naverMap.current,
          title: memberData.name,
          icon: {
            content: `
              <div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: ${isSelected ? '0 0 8px rgba(239, 68, 68, 0.5)' : '0 1px 3px rgba(0,0,0,0.2)'};">
                  <img 
                    src="${photoForMarker}" 
                    alt="${memberData.name}" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    data-gender="${memberData.mt_gender ?? ''}" 
                    data-index="${memberData.original_index}"
                    onerror="
                      const genderStr = this.getAttribute('data-gender');
                      const indexStr = this.getAttribute('data-index');
                      const gender = genderStr ? parseInt(genderStr, 10) : null;
                      const idx = indexStr ? parseInt(indexStr, 10) : 0;
                      const imgNum = (idx % 4) + 1;
                      let fallbackSrc = '/images/avatar' + ((idx % 3) + 1) + '.png';
                      if (gender === 1) { fallbackSrc = '/images/male_' + imgNum + '.png'; }
                      else if (gender === 2) { fallbackSrc = '/images/female_' + imgNum + '.png'; }
                      this.src = fallbackSrc;
                      this.onerror = null;
                    "
                  />
                </div>
                <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">
                  ${memberData.name}
                </div>
              </div>
            `,
            size: new window.naver.maps.Size(36, 48),
            anchor: new window.naver.maps.Point(18, 42)
          }
        });

        // 멤버 InfoWindow 추가
        if (window.naver.maps.InfoWindow && memberData) {
          // 오늘 날짜의 멤버 스케줄들 가져오기
          const today = new Date();
          const todayDateStr = format(today, 'yyyy-MM-dd');
          
          const todaySchedules = (memberData.schedules && safeArrayCheck(memberData.schedules)) 
            ? memberData.schedules.filter(schedule => {
                if (!schedule.date) return false;
                try {
                  const scheduleDate = new Date(schedule.date);
                  const scheduleDateStr = format(scheduleDate, 'yyyy-MM-dd');
                  return scheduleDateStr === todayDateStr;
                } catch (e) {
                  return false;
                }
              })
            : [];

          // 위치 정보 포맷팅 - WebKit 환경에서 강화된 시간 처리
          const isWebKit = typeof window !== 'undefined' && (!!(window as any).webkit || navigator.userAgent.includes('WebKit'));
          const gpsTime = memberData.mlt_gps_time ? new Date(memberData.mlt_gps_time) : null;
          let gpsTimeStr = '정보 없음';
          let timeAgoStr = '';
          
          if (gpsTime) {
            const now = new Date();
            const timeDiff = Math.floor((now.getTime() - gpsTime.getTime()) / 60000); // 분 단위
            
            if (timeDiff < 0) {
              gpsTimeStr = format(gpsTime, 'MM/dd HH:mm');
              timeAgoStr = '(미래시간)';
            } else if (timeDiff < 1) {
              gpsTimeStr = '방금 전';
              timeAgoStr = '';
            } else if (timeDiff < 60) {
              gpsTimeStr = `${timeDiff}분 전`;
              timeAgoStr = `(${format(gpsTime, 'HH:mm')})`;
            } else if (timeDiff < 1440) { // 24시간 미만
              const hours = Math.floor(timeDiff / 60);
              gpsTimeStr = `${hours}시간 전`;
              timeAgoStr = `(${format(gpsTime, 'HH:mm')})`;
            } else {
              gpsTimeStr = format(gpsTime, 'MM/dd HH:mm');
              timeAgoStr = '';
            }
            
            // WebKit 환경에서 추가 정보 표시
            if (isWebKit) {
              console.log('[InfoWindow] WebKit GPS 시간 분석:', {
                memberName: memberData.name,
                gpsTime: gpsTime.toISOString(),
                currentTime: now.toISOString(),
                timeDiffMinutes: timeDiff,
                displayStr: gpsTimeStr
              });
            }
          }
          
          // 배터리 정보
          const batteryLevel = memberData.mlt_battery || 0;
          const batteryColor = batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#EC4899';
          
          // 속도 정보
          const speed = memberData.mlt_speed || 0;
          
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
                .info-window-container {
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
              <div class="info-window-container" style="
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
                <button class="close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                  z-index: 10;
                ">×</button>
                
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
                  👤 ${memberData.name}
                </h3>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🔋 배터리: <span style="color: ${batteryColor}; font-weight: 500;">${batteryLevel}%</span>
                  </p>
                </div>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🚶 속도: ${speed.toFixed(1)}km/h
                  </p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    🕒 GPS 업데이트: ${gpsTimeStr}
                  </p>
                </div>
              </div>
            `,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true,
            pixelOffset: new window.naver.maps.Point(0, -10)
          });

          newMarker.addListener('click', () => {
            // 기존 InfoWindow 닫기
            if (currentInfoWindowRef.current) {
              try {
                currentInfoWindowRef.current.close();
              } catch (e) {
                console.warn('[createMarker] 기존 InfoWindow 닫기 실패:', e);
              }
            }
            
            // 새 InfoWindow 참조 저장 및 열기
            currentInfoWindowRef.current = memberInfoWindow;
            // InfoWindow 열린 시간 기록
            (memberInfoWindow as any)._openTime = Date.now();
            
            try {
              memberInfoWindow.open(naverMap.current, newMarker);
              console.log('[네이버맵] InfoWindow 열기 성공');
              
              // InfoWindow가 열린 후 멤버 선택 처리 (바텀시트 연동) - location 페이지에서는 건너뛰기
              if (memberData && memberData.id && !window.location.pathname.includes('/location')) {
                setTimeout(() => {
                  console.log('[createMarker] 네이버맵 멤버 마커 클릭 - 멤버 선택 (지연):', memberData.name);
                  handleMemberSelect(memberData.id);
                }, 100); // 100ms 지연
              } else if (window.location.pathname.includes('/location')) {
                console.log('[createMarker] location 페이지에서는 멤버 선택 건너뛰기:', memberData?.name);
              }
            } catch (e) {
              console.error('[네이버맵] InfoWindow 열기 실패:', e);
            }
          });
        }

        return newMarker;
      } else if (markerType === 'schedule' && scheduleData) {
        const scheduleTitle = scheduleData.title || '제목 없음';
        const statusDetail = getScheduleStatus(scheduleData);
        const scheduleOrder = index + 1;

        // 시간 포맷팅
        let startTime = '';
        if (scheduleData.date) {
          try {
            const startDateObj = new Date(scheduleData.date);
            if (!isNaN(startDateObj.getTime())) {
              startTime = format(startDateObj, 'HH:mm', { locale: ko });
            }
          } catch (e) { console.error("Error formatting start date:", e); }
        }

        let endTime = '';
        if (scheduleData.sst_edate) {
          try {
            const endDateObj = new Date(scheduleData.sst_edate);
            if (!isNaN(endDateObj.getTime())) {
              endTime = format(endDateObj, 'HH:mm', { locale: ko });
            }
          } catch (e) { console.error("Error formatting end date:", e); }
        }

        const timeRange = (startTime && endTime) ? `${startTime} ~ ${endTime}` : (startTime || '시간 정보 없음');
        
        // 통일된 색상 체계
        const titleTextColor = '#FFFFFF';
        const timeTextColor = '#FFFFFF';
        const titleBgColor = '#4F46E5'; // 인디고 통일
        const timeBgColor = '#EC4899'; // 핑크
        const orderCircleBgColor = '#22C55E'; // 초록
        const orderCircleTextColor = '#FFFFFF';

        const newMarker = new window.naver.maps.Marker({
          position: naverPos,
          map: naverMap.current,
          title: scheduleTitle,
          icon: {
            content: [
              '<div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">',
              `  <div style="width: 16px; height: 16px; background-color: ${orderCircleBgColor}; color: ${orderCircleTextColor}; border-radius: 50%; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-bottom: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); z-index: 1;">`,
              `    ${scheduleOrder}`,
              `  </div>`,
              `  <div style="padding: 4px 8px; background-color: ${titleBgColor}; color: ${titleTextColor}; border-radius: 6px; font-size: 11px; font-weight: normal; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2); margin-bottom: 2px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">`,
              `    ${scheduleTitle}`,
              `  </div>`,
              `  <div style="padding: 2px 6px; background-color: ${timeBgColor}; color: ${timeTextColor}; border-radius: 4px; font-size: 9px; font-weight: normal; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-bottom: 4px;">`,
              `    ${timeRange}`,
              `  </div>`,
              `  <div style="width: 10px; height: 10px; background-color: ${statusDetail.color}; border: 1.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>`,
              '</div>'
            ].join(''),
            size: new window.naver.maps.Size(36, 60),
            anchor: new window.naver.maps.Point(18, 54)
          }
        });

        // InfoWindow 추가 - 일정 리스트와 동일한 스타일 사용
        if (window.naver.maps.InfoWindow) {
          // 반복일정 정보 가져오기
          const repeatIcon = getRepeatIcon(scheduleData);
          const repeatText = getRepeatDisplayText(scheduleData.sst_repeat_json);
          
          const infoWindow = new window.naver.maps.InfoWindow({
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
                .schedule-info-window-container {
                  animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .schedule-close-button {
                  transition: all 0.2s ease;
                }
                .schedule-close-button:hover {
                  background: rgba(0, 0, 0, 0.2) !important;
                  transform: scale(1.1);
                }
              </style>
              <div class="schedule-info-window-container" style="
                padding: 12px 16px;
                min-width: 200px;
                max-width: 280px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                overflow: hidden;
              ">
              <button class="schedule-close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                z-index: 10;
              ">×</button>
              
              <div style="margin-bottom: 8px; padding-right: 25px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #111827; line-height: 1.2;">
                  ${scheduleData.title || '제목 없음'}
                </h3>
              </div>
              
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #4b5563; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">🕒</span>
                  <span>${timeRange}</span>
                </p>
              </div>
              
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #4b5563; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">📍</span>
                  <span style="word-break: keep-all; line-height: 1.3;">${scheduleData.sst_location_add || '위치 정보 없음'}</span>
                </p>
              </div>
              
              ${repeatText !== '없음' ? `
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 11px; color: #4f46e5; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">🔄</span>
                  <span>${repeatText}</span>
                </p>
              </div>
              ` : ''}
              
              <div>
                <span style="
                  font-size: 11px; 
                  color: ${statusDetail.color}; 
                  background: ${statusDetail.bgColor}; 
                  padding: 3px 10px; 
                  border-radius: 12px; 
                  font-weight: 500;
                  border: 1px solid ${statusDetail.color}20;
                ">${statusDetail.text}</span>
              </div>
            </div>
          `,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true,
            pixelOffset: new window.naver.maps.Point(0, -10)
          });

          newMarker.addListener('click', () => {
            // 기존 InfoWindow 닫기
            if (currentInfoWindowRef.current) {
              try {
                currentInfoWindowRef.current.close();
              } catch (e) {
                console.warn('[createMarker] 기존 InfoWindow 닫기 실패:', e);
              }
            }
            
            // 바텀시트에 가려지지 않도록 남쪽으로 오프셋 적용하여 지도 중심 이동
                            const position = new window.naver.maps.LatLng(validLat, validLng);
                naverMap.current.panTo(position, {
              duration: 800,
              easing: 'easeOutCubic'
            });
            
            // 멤버 선택 처리 (바텀시트 연동) - location 페이지에서는 건너뛰기
            if (memberData && memberData.id && !window.location.pathname.includes('/location')) {
              console.log('[createMarker] 네이버맵 스케줄 마커 클릭 - 멤버 선택:', memberData.name);
              handleMemberSelect(memberData.id);
            } else if (window.location.pathname.includes('/location')) {
              console.log('[createMarker] location 페이지에서는 멤버 선택 건너뛰기:', memberData?.name);
            }
            
            // 새 InfoWindow 참조 저장 및 열기
            currentInfoWindowRef.current = infoWindow;
            infoWindow.open(naverMap.current, newMarker);
          });
        }

        return newMarker;
      }
    } else if (mapType === 'google' && map.current && window.google?.maps) {
      if (markerType === 'member' && memberData) {
        // 안전한 이미지 URL 사용
        const photoForMarker = getSafeImageUrl(memberData.photo, memberData.mt_gender, memberData.original_index);
        
        // 선택 상태에 따른 테두리 색상 설정 - 빨간색으로 변경
        const borderColor = isSelected ? '#EF4444' : '#4F46E5'; // 선택시 빨간색, 기본은 인디고
        const shadowEffect = isSelected ? 'filter="drop-shadow(0 0 6px rgba(239,68,68,0.6))"' : '';
        
        const newMarker = new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map.current,
          title: memberData.name,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56" ${shadowEffect}>
                <defs>
                  <pattern id="memberPhoto" patternUnits="userSpaceOnUse" width="28" height="28">
                    <image href="${photoForMarker}" x="0" y="0" width="28" height="28" preserveAspectRatio="xMidYMid slice"/>
                  </pattern>
                </defs>
                <circle cx="20" cy="20" r="16" fill="white" stroke="${borderColor}" stroke-width="${isSelected ? '4' : '3'}"/>
                <circle cx="20" cy="20" r="14" fill="url(#memberPhoto)"/>
                <rect x="8" y="36" width="24" height="14" rx="3" fill="rgba(0,0,0,0.7)"/>
                <text x="20" y="44" text-anchor="middle" fill="white" font-size="8" font-family="Arial">${memberData.name}</text>
              </svg>
            `)}`,
            scaledSize: new window.google.maps.Size(40, 56),
            origin: new window.google.maps.Point(0, 0),
            anchor: new window.google.maps.Point(20, 50),
            labelOrigin: new window.google.maps.Point(20, 56)
          }
        });

        // 멤버 InfoWindow 추가
        if (window.google.maps.InfoWindow && memberData) {
          // 오늘 날짜의 멤버 스케줄들 가져오기
          const today = new Date();
          const todayDateStr = format(today, 'yyyy-MM-dd');
          
          const todaySchedules = (memberData.schedules && safeArrayCheck(memberData.schedules)) 
            ? memberData.schedules.filter(schedule => {
                if (!schedule.date) return false;
                try {
                  const scheduleDate = new Date(schedule.date);
                  const scheduleDateStr = format(scheduleDate, 'yyyy-MM-dd');
                  return scheduleDateStr === todayDateStr;
                } catch (e) {
                  return false;
                }
              })
            : [];

          // 위치 정보 포맷팅
          const gpsTime = memberData.mlt_gps_time ? new Date(memberData.mlt_gps_time) : null;
          const gpsTimeStr = gpsTime ? format(gpsTime, 'MM/dd HH:mm') : '정보 없음';
          
          // 배터리 정보
          const batteryLevel = memberData.mlt_battery || 0;
          const batteryColor = batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#EC4899';
          
          // 속도 정보
          const speed = memberData.mlt_speed || 0;
          
          const memberGoogleInfoWindow = new window.google.maps.InfoWindow({
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
                .info-window-container {
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
              <div class="info-window-container" style="
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
                <button class="close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                  z-index: 10;
                ">×</button>
                
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
                  👤 ${memberData.name}
                </h3>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🔋 배터리: <span style="color: ${batteryColor}; font-weight: 500;">${batteryLevel}%</span>
                  </p>
                </div>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🚶 속도: ${speed.toFixed(1)}km/h
                  </p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    🕒 GPS 업데이트: ${gpsTimeStr}
                  </p>
                </div>
              </div>
            `
          });

          newMarker.addListener('click', () => {
            // 기존 InfoWindow 닫기
            if (currentInfoWindowRef.current) {
              try {
                currentInfoWindowRef.current.close();
              } catch (e) {
                console.warn('[createMarker] 기존 InfoWindow 닫기 실패:', e);
              }
            }
            
            // 멤버 선택 처리 (바텀시트 연동) - location 페이지에서는 건너뛰기
            if (memberData && memberData.id && !window.location.pathname.includes('/location')) {
              console.log('[createMarker] 구글맵 멤버 마커 클릭 - 멤버 선택:', memberData.name);
              handleMemberSelect(memberData.id);
            } else if (window.location.pathname.includes('/location')) {
              console.log('[createMarker] location 페이지에서는 멤버 선택 건너뛰기:', memberData?.name);
            }
            
            // 새 InfoWindow 참조 저장 및 열기
            currentInfoWindowRef.current = memberGoogleInfoWindow;
            memberGoogleInfoWindow.open({
              anchor: newMarker,
              map: map.current
            });
          });
        }

        return newMarker;
      } else if (markerType === 'schedule' && scheduleData) {
        const scheduleTitle = scheduleData.title || '제목 없음';
        const statusDetail = getScheduleStatus(scheduleData);

        // 시간 포맷팅
        let startTime = '';
        if (scheduleData.date) {
          try {
            const startDateObj = new Date(scheduleData.date);
            if (!isNaN(startDateObj.getTime())) {
              startTime = format(startDateObj, 'HH:mm', { locale: ko });
            }
          } catch (e) { console.error("Error formatting start date:", e); }
        }

        let endTime = '';
        if (scheduleData.sst_edate) {
          try {
            const endDateObj = new Date(scheduleData.sst_edate);
            if (!isNaN(endDateObj.getTime())) {
              endTime = format(endDateObj, 'HH:mm', { locale: ko });
            }
          } catch (e) { console.error("Error formatting end date:", e); }
        }

        const timeRange = (startTime && endTime) ? `${startTime} ~ ${endTime}` : (startTime || '시간 정보 없음');

        // 추가 유효성 검사
        if (!map.current) {
          console.error('[createMarker] Google Map instance not ready');
          return null;
        }

        const newMarker = new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map.current,
          title: `${scheduleTitle} (${statusDetail.text}, ${timeRange})`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#4F46E5', // 인디고 통일
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 7 
          }
        });

        // InfoWindow 추가 - 일정 리스트와 동일한 스타일 사용
        if (window.google.maps.InfoWindow) {
          // 반복일정 정보 가져오기
          const repeatIcon = getRepeatIcon(scheduleData);
          const repeatText = getRepeatDisplayText(scheduleData.sst_repeat_json);
          
          const googleInfoWindow = new window.google.maps.InfoWindow({
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
                .google-schedule-info-window-container {
                  animation: slideInFromBottom 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .google-schedule-close-button {
                  transition: all 0.2s ease;
                }
                .google-schedule-close-button:hover {
                  background: rgba(0, 0, 0, 0.2) !important;
                  transform: scale(1.1);
                }
              </style>
              <div class="google-schedule-info-window-container" style="
                padding: 12px 16px;
                min-width: 200px;
                max-width: 280px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                overflow: hidden;
              ">
              <button class="google-schedule-close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                z-index: 10;
              ">×</button>
              
              <div style="margin-bottom: 8px; padding-right: 25px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #111827; line-height: 1.2;">
                  ${scheduleData.title || '제목 없음'}
                </h3>
              </div>
              
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #4b5563; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">🕒</span>
                  <span>${timeRange}</span>
                </p>
              </div>
              
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #4b5563; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">📍</span>
                  <span style="word-break: keep-all; line-height: 1.3;">${scheduleData.sst_location_add || '위치 정보 없음'}</span>
                </p>
              </div>
              
              ${repeatText !== '없음' ? `
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 11px; color: #4f46e5; display: flex; align-items: center;">
                  <span style="margin-right: 6px;">🔄</span>
                  <span>${repeatText}</span>
                </p>
              </div>
              ` : ''}
              
              <div>
                <span style="
                  font-size: 11px; 
                  color: ${statusDetail.color}; 
                  background: ${statusDetail.bgColor}; 
                  padding: 3px 10px; 
                  border-radius: 12px; 
                  font-weight: 500;
                  border: 1px solid ${statusDetail.color}20;
                ">${statusDetail.text}</span>
              </div>
            </div>
            `
          });
          
          // 마커 클릭시 InfoWindow 표시
          newMarker.addListener('click', () => {
            // 기존 InfoWindow 닫기
            if (currentInfoWindowRef.current) {
              try {
                currentInfoWindowRef.current.close();
              } catch (e) {
                console.warn('[createMarker] 기존 InfoWindow 닫기 실패:', e);
              }
            }
            
            // 바텀시트에 가려지지 않도록 남쪽으로 오프셋 적용하여 지도 중심 이동
            const position = { lat: validLat, lng: validLng };
            map.current.panTo(position);
            
            // 새 InfoWindow 참조 저장 및 열기
            currentInfoWindowRef.current = googleInfoWindow;
            googleInfoWindow.open({
              anchor: newMarker,
              map: map.current
            });
          });
        }

        return newMarker;
      }
    }

    return null;
  };

  // 스케줄 마커 업데이트 함수 - createMarker 사용하도록 수정
  const updateScheduleMarkers = (schedules: Schedule[]) => {
    console.log('[updateScheduleMarkers] 스케줄 마커 업데이트 시작:', {
      schedulesCount: schedules.length,
      mapType,
      naverMapReady: !!(mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps),
      googleMapReady: !!(mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps)
    });

    // 기존 스케줄 마커 삭제
    if (scheduleMarkersRef.current.length > 0) {
      console.log('[updateScheduleMarkers] 기존 마커 삭제:', scheduleMarkersRef.current.length, '개');
      scheduleMarkersRef.current.forEach(marker => {
        if (marker && marker.setMap) { // Naver, Google 마커 모두 setMap 메소드를 가짐
          marker.setMap(null);
        }
      });
      scheduleMarkersRef.current = [];
    }

    // 스케줄 데이터 상세 로그
    schedules.forEach((schedule, index) => {
      console.log(`[updateScheduleMarkers] 스케줄 ${index + 1}:`, {
        id: schedule.id,
        title: schedule.title,
        date: schedule.date,
        sst_location_lat: schedule.sst_location_lat,
        sst_location_long: schedule.sst_location_long,
        location: schedule.location,
        sst_location_add: schedule.sst_location_add,
        hasLocationData: !!(schedule.sst_location_lat && schedule.sst_location_long)
      });
    });

    // 새 스케줄 마커 추가 - createMarker 함수 사용
    let markersCreated = 0;
    schedules.forEach((schedule, index) => {
      if (schedule.sst_location_lat && schedule.sst_location_long) {
        console.log(`[updateScheduleMarkers] 마커 생성 시도 - 스케줄 ${index + 1}:`, {
          title: schedule.title,
          lat: schedule.sst_location_lat,
          lng: schedule.sst_location_long
        });

        const newMarker = createMarker(
          null, // location 객체는 사용하지 않음
          index,
          'schedule',
          false,
          undefined,
          schedule
        );
        
        if (newMarker) {
          scheduleMarkersRef.current.push(newMarker);
          markersCreated++;
          console.log(`[updateScheduleMarkers] 마커 생성 성공 - 스케줄: ${schedule.title}`);
        } else {
          console.warn(`[updateScheduleMarkers] 마커 생성 실패 - 스케줄: ${schedule.title}`);
        }
      } else {
        console.log(`[updateScheduleMarkers] 위치 정보 없음 - 스케줄 ${index + 1}:`, {
          title: schedule.title,
          sst_location_lat: schedule.sst_location_lat,
          sst_location_long: schedule.sst_location_long
        });
      }
    });

    console.log(`[updateScheduleMarkers] 마커 업데이트 완료: ${markersCreated}개 생성됨`);
  };

  // filteredSchedules 또는 mapType 변경 시 스케줄 마커 업데이트
  useEffect(() => {
    if ((mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) ||
        (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps)) {
      updateScheduleMarkers(filteredSchedules);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSchedules, mapType, mapsInitialized.google, mapsInitialized.naver]);

  // 그룹 멤버 선택 핸들러 (filteredSchedules 업데이트)
  const handleMemberSelect = (id: string) => {
    // 안전성 체크
    if (!groupMembers || groupMembers.length === 0) {
      console.warn('[handleMemberSelect] groupMembers가 비어있음');
      return;
    }
    
    // 현재 선택된 멤버와 같은 멤버를 재선택하는 경우 아무것도 하지 않음
    const currentSelectedMember = (groupMembers && safeArrayCheck(groupMembers)) ? groupMembers.find(member => member.isSelected) : null;
    if (currentSelectedMember && currentSelectedMember.id === id) {
      console.log('[handleMemberSelect] 같은 멤버 재선택 - 무시:', id);
      return;
    }
    
    // 바텀시트 제거됨 - 드래그 상태 리셋 제거됨
    
    console.log('[handleMemberSelect] 멤버 선택 시작:', id);
    
    const updatedMembers = (groupMembers && safeArrayCheck(groupMembers)) ? groupMembers.map((member: GroupMember) => 
      member.id === id ? { ...member, isSelected: true } : { ...member, isSelected: false }
    ) : [];
    setGroupMembers(updatedMembers);
    const selectedMember = (updatedMembers && safeArrayCheck(updatedMembers)) ? updatedMembers.find((member: GroupMember) => member.isSelected) : null;
    
    console.log('[handleMemberSelect] 멤버 선택:', {
      selectedMemberId: id,
      selectedMemberName: selectedMember?.name,
      selectedDate,
      totalGroupSchedules: groupSchedules.length,
      currentSelectedDate: selectedDate // 현재 선택된 날짜 명시적 표시
    });
    
    // 첫번째 멤버 선택 완료 상태 설정
    if (!isFirstMemberSelectionComplete && selectedMember) {
      setIsFirstMemberSelectionComplete(true);
      setFirstMemberSelected(true);
      console.log('[HOME] 첫번째 멤버 선택 완료:', selectedMember.name);
    }
    
    if (selectedMember) {
      // 현재 선택된 날짜를 사용 (초기 로딩 시에는 오늘 날짜)
      let targetDate = selectedDate;
      
      // sgdt_idx를 기준으로 그룹 스케줄에서 해당 멤버의 스케줄 필터링
      const memberSchedules = (groupSchedules && safeArrayCheck(groupSchedules)) ? groupSchedules.filter(schedule => 
        schedule.sgdt_idx !== null && 
        schedule.sgdt_idx !== undefined && 
        Number(schedule.sgdt_idx) === Number(selectedMember.sgdt_idx) &&
        typeof schedule.date === 'string' && 
        schedule.date!.startsWith(targetDate)
      ) : [];
      console.log('[handleMemberSelect] 선택된 멤버의 스케줄:', {
        memberName: selectedMember.name,
        memberSgdtIdx: selectedMember.sgdt_idx,
        totalMemberSchedules: (groupSchedules && safeArrayCheck(groupSchedules)) ? groupSchedules.filter(s => s.sgdt_idx === selectedMember.sgdt_idx).length : 0,
        filteredSchedules: memberSchedules.length,
        selectedDate,
        targetDate, // 실제 사용된 날짜
        memberSchedulesDetail: memberSchedules.map((s: Schedule) => ({
          id: s.id,
          title: s.title,
          date: s.date,
          sgdt_idx: s.sgdt_idx,
          hasLocation: !!(s.sst_location_lat && s.sst_location_long)
        }))
      });
      
      setFilteredSchedules(memberSchedules);
    } else {
      // 멤버가 선택되지 않은 경우 빈 배열로 설정 (첫 번째 멤버 선택 대기)
      console.log('[handleMemberSelect] 멤버 선택 해제 - 빈 스케줄 배열 설정');
      setFilteredSchedules([]);
    }
    // 마커 업데이트는 useEffect에서 자동으로 처리됨 (groupMembers 변경 감지)
  };

  // 선택된 날짜 변경 핸들러 (filteredSchedules 업데이트)
  const handleDateSelect = (dateValue: string) => {
    console.log('[handleDateSelect] 날짜 선택:', {
      previousDate: selectedDate,
      newDate: dateValue
    });
    
    // 현재 열려있는 InfoWindow가 있으면 먼저 닫기
    if (currentInfoWindowRef.current) {
      try {
        currentInfoWindowRef.current.close();
        currentInfoWindowRef.current = null;
        console.log('[handleDateSelect] 현재 InfoWindow 닫기 완료');
      } catch (e) {
        console.warn('[handleDateSelect] 현재 InfoWindow 닫기 실패:', e);
        currentInfoWindowRef.current = null;
      }
    }
    
    // 날짜 변경 시 모든 InfoWindow 닫기 - 여러 방법 시도
    console.log('[handleDateSelect] InfoWindow 닫기 시작');
    
    if (mapType === 'naver' && window.naver?.maps) {
      // 네이버 지도의 모든 InfoWindow 닫기 - 다양한 선택자 시도
      const naverSelectors = [
        '.iw_container',
        '.iw_content', 
        '.iw_inner',
        '[class*="iw_"]',
        '.infoWindow',
        '.info-window'
      ];
      
      let closedCount = 0;
      naverSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          try {
            // 여러 방법으로 제거 시도
            if (element.parentElement) {
              element.parentElement.remove();
              closedCount++;
            } else {
              element.remove();
              closedCount++;
            }
          } catch (e) {
            console.warn('[handleDateSelect] InfoWindow 제거 실패:', e);
          }
        });
      });
      
      // 추가적으로 visibility hidden 처리
      const allInfoElements = document.querySelectorAll('[class*="info"], [class*="iw"], [id*="info"]');
      allInfoElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
        }
      });
      
      console.log(`[handleDateSelect] 네이버 지도 InfoWindow ${closedCount}개 닫음`);
      
    } else if (mapType === 'google' && window.google?.maps) {
      // 구글 지도의 모든 InfoWindow 닫기 - 다양한 선택자 시도
      const googleSelectors = [
        '.gm-style-iw',
        '.gm-style-iw-c',
        '.gm-style-iw-d',
        '.gm-style-iw-t',
        '[class*="gm-style-iw"]',
        '.infoWindow',
        '.info-window'
      ];
      
      let closedCount = 0;
      googleSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          try {
            (element as HTMLElement).style.display = 'none';
            (element as HTMLElement).style.visibility = 'hidden';
            (element as HTMLElement).style.opacity = '0';
            closedCount++;
          } catch (e) {
            console.warn('[handleDateSelect] 구글 InfoWindow 닫기 실패:', e);
          }
        });
      });
      
      // 구글 지도 InfoWindow 완전 제거 시도
      const iwContainers = document.querySelectorAll('.gm-style-iw-chr');
      iwContainers.forEach(container => {
        try {
          if (container.parentElement) {
            container.parentElement.remove();
          }
        } catch (e) {
          console.warn('[handleDateSelect] 구글 InfoWindow 컨테이너 제거 실패:', e);
        }
      });
      
      console.log(`[handleDateSelect] 구글 지도 InfoWindow ${closedCount}개 닫음`);
    }
    
    // 전역적으로 모든 InfoWindow 관련 요소 숨기기
    setTimeout(() => {
      const allPossibleInfoWindows = document.querySelectorAll(`
        [class*="info"], 
        [class*="Info"], 
        [class*="iw"], 
        [class*="gm-style-iw"], 
        [id*="info"], 
        [id*="Info"]
      `);
      
      allPossibleInfoWindows.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
          element.style.pointerEvents = 'none';
        }
      });
      
      console.log(`[handleDateSelect] 전역 InfoWindow 정리 완료: ${allPossibleInfoWindows.length}개 요소`);
    }, 50);
    
    setSelectedDate(dateValue);
    const selectedMember = (groupMembers && safeArrayCheck(groupMembers)) ? groupMembers.find(member => member.isSelected) : null;
    
    if (selectedMember) {
      // sgdt_idx를 기준으로 그룹 스케줄에서 해당 멤버의 스케줄 필터링
      const memberSchedules = (groupSchedules && safeArrayCheck(groupSchedules)) ? groupSchedules.filter(schedule => 
        schedule.sgdt_idx !== null && 
        schedule.sgdt_idx !== undefined && 
        Number(schedule.sgdt_idx) === Number(selectedMember.sgdt_idx) &&
        typeof schedule.date === 'string' && 
        schedule.date!.startsWith(dateValue)
      ) : [];
      console.log('[handleDateSelect] 선택된 멤버의 날짜별 스케줄:', {
        memberName: selectedMember.name,
        memberSgdtIdx: selectedMember.sgdt_idx,
        selectedDate: dateValue,
        filteredSchedules: memberSchedules.length,
        schedulesDetail: memberSchedules.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          sgdt_idx: s.sgdt_idx,
          hasLocation: !!(s.sst_location_lat && s.sst_location_long)
        }))
      });
      setFilteredSchedules(memberSchedules);
    } else {
      // 멤버가 선택되지 않은 경우 빈 배열로 설정 (첫 번째 멤버 선택 대기)
      console.log('[handleDateSelect] 선택된 멤버 없음 - 빈 스케줄 배열 설정');
      setFilteredSchedules([]);
    }
  };

  // 멤버 마커 업데이트 함수 - 모든 그룹멤버 표시
  const updateMemberMarkers = (members: GroupMember[]) => {
    // 안전성 체크
    if (!members || members.length === 0) {
      console.warn('[updateMemberMarkers] members가 비어있음');
      return;
    }
    
    console.log('[updateMemberMarkers] 🎯 마커 업데이트 시작:', {
      membersCount: members.length,
      selectedMember: (members && safeArrayCheck(members)) ? members.find(m => m.isSelected)?.name || 'none' : 'none',
      currentInfoWindow: currentInfoWindowRef.current ? 'exists' : 'none',
      lastSelectedMember: lastSelectedMemberRef.current,
      mapType: mapType,
      mapInitialized: mapType === 'naver' ? !!naverMap.current : !!map.current,
      membersWithValidLocation: members.filter(m => {
        const realTimeLat = parseCoordinate(m.mlt_lat);
        const realTimeLng = parseCoordinate(m.mlt_long);
        const defaultLat = parseCoordinate(m.location.lat);
        const defaultLng = parseCoordinate(m.location.lng);
        const lat = (realTimeLat !== null && realTimeLat !== 0) ? realTimeLat : defaultLat;
        const lng = (realTimeLng !== null && realTimeLng !== 0) ? realTimeLng : defaultLng;
        return lat !== null && lng !== null && lat !== 0 && lng !== 0;
      }).length
    });
    
    // 선택된 멤버 확인
    const currentSelectedMember = (members && safeArrayCheck(members)) ? members.find(member => member.isSelected) : null;
    const selectedMemberName = currentSelectedMember?.name || null;
    
    // 같은 멤버가 이미 선택되어 있고 InfoWindow가 열려있으면 중복 실행 방지
    if (selectedMemberName && 
        lastSelectedMemberRef.current === selectedMemberName && 
        currentInfoWindowRef.current) {
      console.log('[updateMemberMarkers] 같은 멤버 중복 실행 방지:', selectedMemberName);
      return;
    }
    
    // 마지막 선택된 멤버 업데이트
    lastSelectedMemberRef.current = selectedMemberName;
    
    // 기존 마커 삭제
    if (memberMarkers.current.length > 0) {
      memberMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      memberMarkers.current = [];
    }
    
    // 모든 그룹멤버에 대해 마커 생성
    if (members.length > 0) {
      (members && safeArrayCheck(members)) && members.forEach((member, index) => {
        // 좌표 안전성 검사 - 실시간 GPS 위치(mlt_lat, mlt_long) 우선 사용
        const realTimeLat = parseCoordinate(member.mlt_lat);
        const realTimeLng = parseCoordinate(member.mlt_long);
        const defaultLat = parseCoordinate(member.location.lat);
        const defaultLng = parseCoordinate(member.location.lng);
        
        const lat = (realTimeLat !== null && realTimeLat !== 0) ? realTimeLat : defaultLat;
        const lng = (realTimeLng !== null && realTimeLng !== 0) ? realTimeLng : defaultLng;

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          console.log('[updateMemberMarkers] 멤버 마커 생성:', member.name, { lat, lng });
          
          // createMarker 함수를 사용하여 InfoWindow가 포함된 마커 생성
          const newMarker = createMarker(
            { lat, lng },
            index,
            'member',
            member.isSelected,
            member,
            undefined
          );
          
          if (newMarker) {
            // 추가 설정: 선택된 멤버는 z-index를 높게 설정
            if (mapType === 'naver' && newMarker.setZIndex) {
              newMarker.setZIndex(member.isSelected ? 200 : 150);
            } else if (mapType === 'google' && newMarker.setZIndex) {
              newMarker.setZIndex(member.isSelected ? 200 : 150);
            }
            
            memberMarkers.current.push(newMarker);
          }
        } else {
          console.warn('유효하지 않은 멤버 좌표:', member.name, member.location);
        }
      });
    }
    
    // 선택된 멤버가 있으면 해당 위치로 지도 이동 및 InfoWindow 표시
    const selectedMember = (members && safeArrayCheck(members)) ? members.find(member => member.isSelected) : null;
    if (selectedMember) {
      // 실시간 GPS 위치(mlt_lat, mlt_long) 우선 사용
      const realTimeLat = parseCoordinate(selectedMember.mlt_lat);
      const realTimeLng = parseCoordinate(selectedMember.mlt_long);
      const defaultLat = parseCoordinate(selectedMember.location.lat);
      const defaultLng = parseCoordinate(selectedMember.location.lng);
      
      const lat = (realTimeLat !== null && realTimeLat !== 0) ? realTimeLat : defaultLat;
      const lng = (realTimeLng !== null && realTimeLng !== 0) ? realTimeLng : defaultLng;

      if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
        // 기존 InfoWindow 닫기 (새로운 멤버 선택 시)
        if (currentInfoWindowRef.current) {
          try {
            currentInfoWindowRef.current.close();
            currentInfoWindowRef.current = null;
            console.log('[updateMemberMarkers] 기존 InfoWindow 닫기 완료');
          } catch (e) {
            console.warn('[updateMemberMarkers] 기존 InfoWindow 닫기 실패:', e);
            currentInfoWindowRef.current = null;
          }
        }

        if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
          // 네이버 지도 이동 및 줌 레벨 조정 (즉시 실행)
          const targetLatLng = createSafeLatLng(lat, lng);
          if (targetLatLng) {
            naverMap.current.panTo(targetLatLng, {
              duration: 300,
              easing: 'easeOutCubic'
            });
          }
            naverMap.current.setZoom(16);
            console.log('네이버 지도 중심 이동:', selectedMember.name, { lat, lng });

          // 선택된 멤버의 InfoWindow 자동 표시 (중복 방지) - 짧은 지연
          setTimeout(() => {
            const selectedMarkerIndex = (members && safeArrayCheck(members)) ? members.findIndex(member => member.isSelected) : -1;
            const selectedMarker = memberMarkers.current[selectedMarkerIndex];
            
            if (selectedMarker && window.naver?.maps?.InfoWindow) {
              // InfoWindow가 이미 열려있고 같은 멤버인 경우 중복 생성 방지
              if (currentInfoWindowRef.current) {
                const currentMemberName = (currentInfoWindowRef.current as any)._memberName;
                if (currentMemberName === selectedMember.name) {
                  console.log('[updateMemberMarkers] InfoWindow가 이미 열려있음, 중복 생성 방지:', selectedMember.name);
                  return;
                }
                // 다른 멤버의 InfoWindow가 열려있으면 닫기
                try {
                  currentInfoWindowRef.current.close();
                  currentInfoWindowRef.current = null;
                } catch (e) {
                  console.warn('[updateMemberMarkers] 기존 InfoWindow 닫기 실패:', e);
                }
              }
              
              console.log('[updateMemberMarkers] 선택된 멤버 InfoWindow 자동 표시:', selectedMember.name);

              // 오늘 날짜의 멤버 스케줄들 가져오기 (안전성 체크 포함)
              const today = new Date();
              const todayDateStr = format(today, 'yyyy-MM-dd');
              
              const todaySchedules = (selectedMember.schedules && safeArrayCheck(selectedMember.schedules)) ? selectedMember.schedules.filter(schedule => {
                if (!schedule.date) return false;
                try {
                  const scheduleDate = new Date(schedule.date);
                  const scheduleDateStr = format(scheduleDate, 'yyyy-MM-dd');
                  return scheduleDateStr === todayDateStr;
                } catch (e) {
                  return false;
                }
              }) : [];

              // 위치 정보 포맷팅
              const gpsTime = selectedMember.mlt_gps_time ? new Date(selectedMember.mlt_gps_time) : null;
              const gpsTimeStr = gpsTime ? format(gpsTime, 'MM/dd HH:mm') : '정보 없음';
              
              // 배터리 정보
              const batteryLevel = selectedMember.mlt_battery || 0;
              const batteryColor = batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#EC4899';
              
              // 속도 정보
              const speed = selectedMember.mlt_speed || 0;

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
                    .info-window-container {
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
                  <div class="info-window-container" style="
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
                    <button class="close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                      z-index: 10;
                    ">×</button>
                    
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
                      👤 ${selectedMember.name}
                    </h3>
                    <div style="margin-bottom: 6px;">
                      <p style="margin: 0; font-size: 12px; color: #64748b;">
                        🔋 배터리: <span style="color: ${batteryColor}; font-weight: 500;">${batteryLevel}%</span>
                      </p>
                    </div>
                    <div style="margin-bottom: 6px;">
                      <p style="margin: 0; font-size: 12px; color: #64748b;">
                        🚶 속도: ${speed.toFixed(1)}km/h
                      </p>
                    </div>
                    <div>
                      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                        🕒 GPS 업데이트: ${gpsTimeStr}
                      </p>
                    </div>
                  </div>
                `,
                borderWidth: 0,
                backgroundColor: 'transparent',
                disableAnchor: true,
                pixelOffset: new window.naver.maps.Point(0, -10)
              });

              // InfoWindow 참조 저장 및 열기
              currentInfoWindowRef.current = memberInfoWindow;
              (memberInfoWindow as any)._openTime = Date.now();
              (memberInfoWindow as any)._memberName = selectedMember.name; // 멤버 이름 저장
              
              try {
                memberInfoWindow.open(naverMap.current, selectedMarker);
                console.log('[updateMemberMarkers] 자동 InfoWindow 표시 완료:', selectedMember.name);
              } catch (e) {
                console.error('[updateMemberMarkers] InfoWindow 열기 실패:', e);
              }
            }
          }, 100); // 지도 이동 후 InfoWindow 표시 (지연 시간 단축)
        } else if (mapType === 'google' && map.current && googleMapsLoaded) {
          // 구글 지도 이동 및 줌 레벨 조정 (즉시 실행)
            map.current.panTo({ lat, lng });
            map.current.setZoom(16);
            console.log('구글 지도 중심 이동:', selectedMember.name, { lat, lng });

          // 구글 지도용 InfoWindow 자동 표시 (짧은 지연)
          setTimeout(() => {
            const selectedMarkerIndex = (members && safeArrayCheck(members)) ? members.findIndex(member => member.isSelected) : -1;
            const selectedMarker = memberMarkers.current[selectedMarkerIndex];
            
                                      if (selectedMarker && window.google?.maps?.InfoWindow) {
               // InfoWindow가 이미 열려있고 같은 멤버인 경우 중복 생성 방지
               if (currentInfoWindowRef.current) {
                 const currentMemberName = (currentInfoWindowRef.current as any)._memberName;
                 if (currentMemberName === selectedMember.name) {
                   console.log('[updateMemberMarkers] 구글 InfoWindow가 이미 열려있음, 중복 생성 방지:', selectedMember.name);
                   return;
                 }
                 // 다른 멤버의 InfoWindow가 열려있으면 닫기
                 try {
                   currentInfoWindowRef.current.close();
                   currentInfoWindowRef.current = null;
                 } catch (e) {
                   console.warn('[updateMemberMarkers] 구글 기존 InfoWindow 닫기 실패:', e);
                 }
               }
              
                             console.log('[updateMemberMarkers] 구글 선택된 멤버 InfoWindow 자동 표시:', selectedMember.name);

              // 오늘 날짜의 멤버 스케줄들 가져오기 (안전성 체크 포함)
              const today = new Date();
              const todayDateStr = format(today, 'yyyy-MM-dd');
              
              const todaySchedules = (selectedMember.schedules && safeArrayCheck(selectedMember.schedules)) ? selectedMember.schedules.filter(schedule => {
                if (!schedule.date) return false;
                try {
                  const scheduleDate = new Date(schedule.date);
                  const scheduleDateStr = format(scheduleDate, 'yyyy-MM-dd');
                  return scheduleDateStr === todayDateStr;
                } catch (e) {
                  return false;
                }
              }) : [];

              // 위치 정보 포맷팅
              const gpsTime = selectedMember.mlt_gps_time ? new Date(selectedMember.mlt_gps_time) : null;
              const gpsTimeStr = gpsTime ? format(gpsTime, 'MM/dd HH:mm') : '정보 없음';
              
              // 배터리 정보
              const batteryLevel = selectedMember.mlt_battery || 0;
              const batteryColor = batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#EC4899';
              
              // 속도 정보
              const speed = selectedMember.mlt_speed || 0;

              const memberInfoWindow = new window.google.maps.InfoWindow({
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
                    .info-window-container {
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
                  <div class="info-window-container" style="
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
                    <button class="close-button" onclick="window.closeCurrentInfoWindow && window.closeCurrentInfoWindow(); event.stopPropagation();" style="
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
                      z-index: 10;
                    ">×</button>
                    
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
                      👤 ${selectedMember.name}
                    </h3>
                    <div style="margin-bottom: 6px;">
                      <p style="margin: 0; font-size: 12px; color: #64748b;">
                        🔋 배터리: <span style="color: ${batteryColor}; font-weight: 500;">${batteryLevel}%</span>
                      </p>
                    </div>
                    <div style="margin-bottom: 6px;">
                      <p style="margin: 0; font-size: 12px; color: #64748b;">
                        🚗 속도: <span style="color: #3b82f6; font-weight: 500;">${speed} km/h</span>
                      </p>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 6px;">
                      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                        📍 GPS 업데이트: ${gpsTimeStr}
                      </p>
                    </div>
                  </div>
                `
              });

                             // InfoWindow 참조 저장 및 열기
               currentInfoWindowRef.current = memberInfoWindow;
               (memberInfoWindow as any)._openTime = Date.now();
               (memberInfoWindow as any)._memberName = selectedMember.name; // 멤버 이름 저장
               
               try {
                 memberInfoWindow.open(map.current, selectedMarker);
                 console.log('[updateMemberMarkers] 구글 자동 InfoWindow 표시 완료:', selectedMember.name);
               } catch (e) {
                 console.error('[updateMemberMarkers] 구글 InfoWindow 열기 실패:', e);
               }
            }
          }, 100); // 지도 이동 후 InfoWindow 표시 (지연 시간 단축)
        }
      } else {
        console.warn('유효하지 않은 멤버 좌표:', selectedMember.name, selectedMember.location);
      }
    }
  };

  // 지도 타입 변경 시 멤버 마커 업데이트
  useEffect(() => {
    // 마커 업데이트 중복 방지
    if (markersUpdating.current) {
      console.log('[HOME] 마커 업데이트 중이므로 중복 실행 방지');
      return;
    }

    if (
      (mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
      (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps)
    ) {
      markersUpdating.current = true;
      console.log('[HOME] 지도 타입 변경으로 마커 업데이트 시작');
      updateMemberMarkers(groupMembers);
      updateScheduleMarkers(filteredSchedules); 
      setTimeout(() => {
        markersUpdating.current = false;
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType, mapsInitialized.google, mapsInitialized.naver]);

  // 현재 위치 마커 생성 함수
  const createCurrentLocationMarker = () => {
    if (!userLocation.lat || !userLocation.lng) {
      console.log('[createCurrentLocationMarker] 현재 위치 정보 없음');
      return;
    }

    console.log('[createCurrentLocationMarker] 현재 위치 마커 생성:', userLocation);

    if (mapType === 'naver' && naverMap.current && window.naver?.maps) {
      // 기존 현재 위치 마커 제거
      if (naverMarker.current) {
        naverMarker.current.setMap(null);
        naverMarker.current = null;
      }

      // 새 현재 위치 마커 생성
      const currentPosition = createSafeLatLng(userLocation.lat, userLocation.lng);
      if (!currentPosition) {
        console.error('[createCurrentLocationMarker] 현재 위치 LatLng 생성 실패');
        return;
      }

      naverMarker.current = new window.naver.maps.Marker({
        position: currentPosition,
        map: naverMap.current,
        icon: {
          content: '<div style="width: 20px; height: 20px; background-color: #3b82f6; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          size: new window.naver.maps.Size(20, 20),
          anchor: new window.naver.maps.Point(10, 10)
        },
        zIndex: 100
      });

      // 지도 중심을 현재 위치로 이동
      naverMap.current.panTo(currentPosition);
      naverMap.current.setZoom(16);

    } else if (mapType === 'google' && map.current && window.google?.maps) {
      // 기존 현재 위치 마커 제거
      if (marker.current) {
        marker.current.setMap(null);
        marker.current = null;
      }

      // 새 현재 위치 마커 생성
      marker.current = new window.google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
          scale: 10
        },
        zIndex: 100
      });

      // 지도 중심을 현재 위치로 이동
      map.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      map.current.setZoom(16);
    }
  };

  // 그룹멤버 데이터 변경 시 마커 업데이트 - 멤버가 없을 때 현재 위치 마커 생성
  useEffect(() => {
    // 마커 업데이트 중복 방지
    if (markersUpdating.current) {
      console.log('[HOME] 마커 업데이트 중이므로 중복 실행 방지');
      return;
    }

    // 지도가 초기화되지 않았으면 대기
    if (!((mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
          (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps))) {
      console.log('[HOME] 지도 초기화 대기 중');
      return;
    }

    // 데이터 로딩이 완료되지 않았으면 대기
    if (dataFetchedRef.current.loading) {
      console.log('[HOME] 그룹 데이터 로딩 중이므로 대기');
      return;
    }

    markersUpdating.current = true;

    // 그룹 멤버가 있으면 멤버 마커 생성
    if (groupMembers.length > 0) {
      console.log('[HOME] 그룹멤버 데이터 변경 감지 - 멤버 마커 업데이트:', groupMembers.length, '명');
      
      // 현재 위치 마커 제거 (멤버 마커가 있을 때)
      if (mapType === 'naver' && naverMarker.current) {
        naverMarker.current.setMap(null);
        naverMarker.current = null;
      } else if (mapType === 'google' && marker.current) {
        marker.current.setMap(null);
        marker.current = null;
      }

      // 300ms 지연으로 멤버 마커 업데이트 실행 (깜빡임 방지)
      const updateTimer = setTimeout(() => {
        updateMemberMarkers(groupMembers);
        
        // 마커 업데이트 완료 후 플래그 해제
        setTimeout(() => {
          markersUpdating.current = false;
        }, 500);
      }, 300);
      
      return () => {
        clearTimeout(updateTimer);
        markersUpdating.current = false;
      };
    } else {
      // 그룹 멤버가 없으면 현재 위치 마커 생성
      console.log('[HOME] 그룹멤버 없음 - 현재 위치 마커 생성');
      
      // 즉시 현재 위치 마커 생성
      createCurrentLocationMarker();
      
      setTimeout(() => {
        markersUpdating.current = false;
      }, 100);
    }
  }, [groupMembers, mapType, mapsInitialized.naver, mapsInitialized.google, dataFetchedRef.current.loading]);

  // filteredSchedules 변경 시 일정 마커 업데이트
  useEffect(() => {
    // 마커 업데이트 중복 방지
    if (markersUpdating.current) {
      console.log('[HOME] 마커 업데이트 중이므로 일정 마커 업데이트 건너뛰기');
      return;
    }

    if (
      filteredSchedules.length >= 0 && // 0개도 유효한 상태 (빈 배열)
      ((mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
       (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps))
    ) {
      console.log('[HOME] filteredSchedules 변경 감지 - 일정 마커 업데이트:', filteredSchedules.length, '개');
      
      // 즉시 일정 마커 업데이트 실행
      updateScheduleMarkers(filteredSchedules);
    }
  }, [filteredSchedules, mapType, mapsInitialized.naver, mapsInitialized.google]);

  // 🎯 초기 로딩 완료 후 마커 강제 업데이트 (구글 로그인 후 마커 표시 보장)
  useEffect(() => {
    // 모든 조건이 만족되고 첫 번째 멤버 선택이 완료된 후 마커 강제 업데이트
    if (
      isFirstMemberSelectionComplete &&
      groupMembers.length > 0 &&
      ((mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
       (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps)) &&
      !dataFetchedRef.current.loading &&
      !markersUpdating.current
    ) {
      console.log('[HOME] 🎯 초기 로딩 완료 후 마커 강제 업데이트 실행');
      
      setTimeout(() => {
        console.log('[HOME] 📍 마커 강제 업데이트:', {
          groupMembersCount: groupMembers.length,
          mapType,
          selectedMember: groupMembers.find(m => m.isSelected)?.name || 'none',
          firstMemberName: groupMembers[0]?.name
        });
        
        markersUpdating.current = true;
        
        // 멤버 마커 강제 업데이트
        updateMemberMarkers(groupMembers);
        
        // 선택된 멤버의 일정 마커도 업데이트
        const selectedMember = groupMembers.find(m => m.isSelected);
        if (selectedMember && selectedMember.schedules) {
          const today = new Date().toISOString().split('T')[0];
          const todaySchedules = selectedMember.schedules.filter(schedule => 
            schedule.date && schedule.date.startsWith(today)
          );
          setFilteredSchedules(todaySchedules);
          updateScheduleMarkers(todaySchedules);
        }
        
        setTimeout(() => {
          markersUpdating.current = false;
        }, 500);
      }, 500); // 안정적인 마커 업데이트를 위한 지연
    }
  }, [
    isFirstMemberSelectionComplete,
    groupMembers.length,
    mapType,
    mapsInitialized.naver,
    mapsInitialized.google,
    dataFetchedRef.current.loading
  ]);

  // 지도 타입 변경 핸들러
  const handleMapTypeChange = () => {
    setMapType(prevType => prevType === 'google' ? 'naver' : 'google');
  };

  // 위치 정보를 지도에 업데이트
  const updateMapPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setIsLocationEnabled(true);
          setLocationName("현재 위치");
          
          if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
            const naverLatLng = createSafeLatLng(latitude, longitude);
            if (naverLatLng) {
              naverMap.current.setCenter(naverLatLng);
              naverMap.current.setZoom(16);
              
              if (naverMarker.current) {
                naverMarker.current.setPosition(naverLatLng);
              }
            }
          } else if (mapType === 'google' && map.current && googleMapsLoaded) {
            map.current.panTo({ lat: latitude, lng: longitude });
            map.current.setZoom(16);
            
            if (marker.current) {
              marker.current.setPosition({ lat: latitude, lng: longitude });
            }
          }
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  // 오늘부터 6일 후까지 가져오기 (총 7일)
  const getNext7Days = () => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      const isToday = i === 0;
      const isTomorrow = i === 1;
      
      let displayText = '';
      if (isToday) {
        displayText = '오늘';
      } else {
        displayText = format(date, 'MM.dd(E)', { locale: ko });
      }
      
      return {
        value: format(date, 'yyyy-MM-dd'),
        display: displayText
      };
    });
  };

  // 거리 포맷팅 함수
  const formatDistance = (km: number) => {
    return km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)}km`;
  };

  // 헤더와 컨트롤 버튼의 클래스
  const getHeaderClassName = () => {
    return 'fixed bottom-4 left-4 z-10 opacity-100';
  };

  // 컨트롤 버튼 클래스
  const getControlsClassName = () => {
    return 'fixed bottom-4 right-4 z-10';
  };

  


  // 초기 데이터 로딩 최적화 - 지연 시간 단축
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialDataLoaded(true);
    }, 300); // 300ms로 단축하여 빠른 초기화

    // 백업 타이머: 1.5초 후에는 강제로 지도 로딩도 완료 처리
    const backupTimer = setTimeout(() => {
      setIsMapLoading(false);
      // 지도 초기화 상태도 강제로 설정
      setMapsInitialized(prev => ({
        naver: true,
        google: true
      }));
      console.log('[HOME] 백업 타이머로 지도 로딩 및 초기화 강제 완료 (1.5초)');
    }, 1500); // 3초 → 1.5초로 단축

    return () => {
      clearTimeout(timer);
      clearTimeout(backupTimer);
    };
  }, []);



  // 그룹 선택 핸들러 - location/page.tsx와 동일한 패턴으로 수정
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 바텀시트 제거됨
    
    // 기존 데이터 초기화 - location/page.tsx와 동일한 패턴
    setGroupMembers([]);
    setGroupSchedules([]);
    setFilteredSchedules([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
            dataFetchedRef.current = { members: false, schedules: false, loading: false, currentGroupId: null };
    
    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');
  };

  // 그룹 선택 드롭다운 외부 클릭 시 닫기 - 개선된 로직
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isGroupSelectorOpen && groupDropdownRef.current) {
        const target = event.target as Node;
        
        // 클릭된 요소가 드롭다운 컨테이너 내부에 있는지 확인
        if (!groupDropdownRef.current.contains(target)) {
          console.log('[그룹 드롭다운] 외부 클릭으로 드롭다운 닫기');
          setIsGroupSelectorOpen(false);
        }
      }
    };

    if (isGroupSelectorOpen) {
      // mousedown 대신 click 이벤트 사용 (더 안정적)
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isGroupSelectorOpen]);

  // 첫번째 멤버 자동 선택을 위한 안전한 조건 검사
  const shouldSelectFirstMember = useMemo(() => {
    try {
      return groupMembers && safeArrayCheck(groupMembers) && groupMembers.length > 0 && 
             !(groupMembers && safeArrayCheck(groupMembers) && groupMembers.some(m => m.isSelected)) && 
             !firstMemberSelected &&
             selectedGroupId;
    } catch (error) {
      console.error('[HOME] shouldSelectFirstMember 계산 오류:', error);
      return false;
    }
  }, [groupMembers?.length, groupMembers?.some && groupMembers.some(m => m.isSelected), firstMemberSelected, selectedGroupId]);

  // 첫번째 멤버 자동 선택 - 직접 상태 업데이트 방식 (iOS WebView 타임아웃 방지)
  useEffect(() => {
    if (!isMounted || !shouldSelectFirstMember || !groupMembers?.[0]) return;
    
    console.log('[HOME] 첫번째 멤버 자동 선택 조건 만족:', {
      memberCount: groupMembers.length,
      hasSelectedMember: groupMembers && safeArrayCheck(groupMembers) ? groupMembers.some(m => m.isSelected) : false,
      firstMemberSelected,
      selectedGroupId
    });
    
    // 중복 실행 방지
    setFirstMemberSelected(true);
    
    // 첫번째 멤버 직접 선택 (handleMemberSelect 호출 없이)
    const firstMember = groupMembers[0];
    console.log('[HOME] 첫번째 멤버 자동 선택 실행:', firstMember.name, firstMember.id);
    
    // 직접 상태 업데이트 (마커 중복 업데이트 방지)
    const updatedMembers = (groupMembers || []).map(member => ({
      ...member,
      isSelected: member.id === firstMember.id
    }));
    
    setGroupMembers(updatedMembers);
    
    // 첫번째 멤버의 스케줄 필터링 (selectedDate가 빈 문자열이면 오늘 날짜 사용)
    const targetDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
    const memberSchedules = (groupSchedules && safeArrayCheck(groupSchedules)) ? groupSchedules.filter(schedule => 
      schedule.sgdt_idx !== null && 
      schedule.sgdt_idx !== undefined && 
      Number(schedule.sgdt_idx) === Number(firstMember.sgdt_idx) &&
      typeof schedule.date === 'string' && 
      schedule.date!.startsWith(targetDate)
    ) : [];
    
    setFilteredSchedules(memberSchedules);
    console.log('[HOME] 첫번째 멤버 자동 선택 완료:', firstMember.name, '스케줄:', memberSchedules.length, '개');
  }, [shouldSelectFirstMember, groupMembers, groupSchedules, selectedDate]);

  // 컴포넌트 마운트 시 초기 상태 체크 (안전장치)
  useEffect(() => {
    console.log('[HOME] 컴포넌트 마운트 후 초기 상태 체크:', {
      groupMembersLength: groupMembers?.length || 0,
      selectedGroupId,
      firstMemberSelected,
      hasSelectedMember: groupMembers && safeArrayCheck(groupMembers) ? groupMembers.some(m => m.isSelected) : false
    });
  }, []);

  // userGroups 길이와 내용에 따른 안전한 의존성
  const userGroupsStableRef = useMemo(() => {
    try {
      return userGroups?.map(g => ({ sgt_idx: g.sgt_idx, member_count: g.member_count })) || [];
    } catch (error) {
      console.error('[HOME] userGroupsStableRef 계산 오류:', error);
      return [];
    }
  }, [userGroups?.length, userGroups?.map && userGroups.map(g => g.member_count).join(',')]);

  // 그룹별 멤버 수 조회 (UserContext 데이터 우선 사용)
  useEffect(() => {
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log('[HOME] 그룹 멤버 수 조회 시작:', userGroups.length, '개 그룹');
      
      const counts: Record<number, number> = {};
      
      // UserContext의 그룹 데이터에서 멤버 수 직접 사용 (API 호출 없음)
      userGroups.forEach(group => {
        if (group.member_count !== undefined) {
          counts[group.sgt_idx] = group.member_count;
          console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 (UserContext):`, group.member_count);
        } else {
          // 캐시된 데이터에서 멤버 수 확인
          const cachedMembers = getGroupMembers(group.sgt_idx);
          const isMemberCacheValid = isCacheValid('groupMembers', group.sgt_idx);
          
          if (cachedMembers && cachedMembers.length > 0 && isMemberCacheValid) {
            counts[group.sgt_idx] = cachedMembers.length;
            console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 (캐시):`, cachedMembers.length);
          } else {
            // API 호출로 실제 멤버 수 확인
            console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 캐시 없음, API 호출 중...`);
            getGroupMemberCount(group.sgt_idx).then(memberCount => {
              setGroupMemberCounts(prevCounts => ({
                ...prevCounts,
                [group.sgt_idx]: memberCount
              }));
              console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 (API):`, memberCount);
            }).catch(error => {
              console.error(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 조회 실패:`, error);
              counts[group.sgt_idx] = 0;
            });
            
            // 임시로 0 설정 (API 완료 시 업데이트됨)
            counts[group.sgt_idx] = 0;
            console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수 (임시):`, 0);
          }
        }
      });
      
      setGroupMemberCounts(counts);
      console.log('[HOME] 그룹 멤버 수 조회 완료 (API 호출 없음):', counts);
    };

    fetchGroupMemberCounts();
  }, [userGroupsStableRef]); // 안정적인 참조 사용

  // 새로운 알림 확인 (사용자 로그인 후) - 최적화
  useEffect(() => {
    if (user?.mt_idx && !authLoading) {
      // 초기 알림 확인은 1초 지연 후 실행 (다른 초기화 완료 후)
      const initialTimer = setTimeout(() => {
        checkNewNotifications();
      }, 1000);
      
      // 5분마다 새로운 알림 확인 (3분 → 5분으로 변경)
      const interval = setInterval(checkNewNotifications, 5 * 60 * 1000);
      
      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [user?.mt_idx, authLoading]);

  // 그룹 멤버 수를 가져오는 함수 (캐시 우선 사용)
  const getGroupMemberCount = async (groupId: number): Promise<number> => {
    try {
      // 🔥 캐시된 멤버 데이터 먼저 확인
      const cachedMembers = getGroupMembers(groupId);
      const isMemberCacheValid = isCacheValid('groupMembers', groupId);
      
      if (cachedMembers && cachedMembers.length > 0 && isMemberCacheValid) {
        console.log(`[getGroupMemberCount] 캐시된 데이터 사용 - 그룹 ${groupId}:`, cachedMembers.length, '명');
        return cachedMembers.length;
      }
      
      // 캐시가 없으면 API 호출
      console.log(`[getGroupMemberCount] 캐시 없음 - API 호출 - 그룹 ${groupId}`);
      const memberData = await memberService.getGroupMembers(groupId.toString());
      return memberData ? memberData.length : 0;
    } catch (error) {
      console.error(`그룹 ${groupId} 멤버 수 조회 실패:`, error);
      return 0;
    }
  };

  // 새로운 알림 확인 함수 - DB 구조에 맞게 개선
  const checkNewNotifications = async () => {
    try {
      if (!user?.mt_idx) return;
      
      const notifications = await notificationService.getMemberPushLogs(user.mt_idx);
      
      // 읽지 않은 알림이 있는지 확인 (plt_read_chk가 'N'인 것)
      const hasUnread = (notifications && safeArrayCheck(notifications)) 
        ? notifications.some(notification => {
            return notification.plt_read_chk === 'N' && 
                   notification.plt_show === 'Y' && 
                   notification.plt_status === 2; // 전송 완료된 알림만
          })
        : false;
      
      setHasNewNotifications(hasUnread);
      console.log('[HOME] 새로운 알림 확인:', { 
        hasUnread, 
        totalNotifications: notifications.length,
        unreadCount: (notifications && safeArrayCheck(notifications)) ? notifications.filter(n => n.plt_read_chk === 'N').length : 0
      });
    } catch (error) {
      console.error('[HOME] 알림 확인 실패:', error);
      setHasNewNotifications(false);
    }
  };

  // filteredSchedules 상태 디버깅
  useEffect(() => {
    console.log('[RENDER] 일정 리스트 상태 변경:', {
      filteredSchedulesLength: filteredSchedules.length,
      selectedMember: (groupMembers && safeArrayCheck(groupMembers)) ? groupMembers.find(m => m.isSelected)?.name : null,
      selectedMemberSgdtIdx: (groupMembers && safeArrayCheck(groupMembers)) ? groupMembers.find(m => m.isSelected)?.sgdt_idx : null,
      selectedDate,
      schedules: (filteredSchedules && safeArrayCheck(filteredSchedules)) ? filteredSchedules.map(s => ({
        id: s.id,
        title: s.title,
        date: s.date,
        sgdt_idx: s.sgdt_idx
      })) : []
    });
  }, [filteredSchedules, groupMembers, selectedDate]);

  // 일정 선택 핸들러 - 해당 일정 위치로 지도 이동
  const handleScheduleSelect = (schedule: Schedule) => {
    console.log('[handleScheduleSelect] 스케줄 선택:', {
      id: schedule.id,
      title: schedule.title,
      date: schedule.date,
      location: schedule.location,
      isRepeating: isRepeatingSchedule(schedule),
      repeatJson: schedule.sst_repeat_json,
      repeatText: getRepeatDisplayText(schedule.sst_repeat_json),
      sst_pidx: schedule.sst_pidx,
      sst_location_lat: schedule.sst_location_lat,
      sst_location_long: schedule.sst_location_long
    });
    
    // 스케줄에 위치 정보가 있는지 확인
    const lat = parseCoordinate(schedule.sst_location_lat);
    const lng = parseCoordinate(schedule.sst_location_long);
    
    if (!lat || !lng) {
      console.warn('[handleScheduleSelect] 스케줄 위치 정보가 없습니다:', schedule.title);
      return;
    }
    
    // 기존 InfoWindow 닫기
    if (currentInfoWindowRef.current) {
      try {
        currentInfoWindowRef.current.close();
        currentInfoWindowRef.current = null;
      } catch (e) {
        console.warn('[handleScheduleSelect] 기존 InfoWindow 닫기 실패:', e);
      }
    }
    
    // 해당 스케줄의 마커 찾기
    const scheduleIndex = filteredSchedules.findIndex(s => s.id === schedule.id);
    
    // 지도 타입에 따른 포커스 이동
    if (mapType === 'naver' && naverMap.current) {
      const location = createSafeLatLng(lat, lng);
      if (!location) {
        console.error('[handleScheduleSelect] LatLng 객체 생성 실패');
        return;
      }
      naverMap.current.panTo(location, {
        duration: 800,
        easing: 'easeOutCubic'
      });
      naverMap.current.setZoom(16);
      
      // 해당 마커의 클릭 이벤트 트리거 (InfoWindow는 마커에서 이미 생성됨)
      if (scheduleIndex !== -1 && scheduleMarkersRef.current[scheduleIndex]) {
        const marker = scheduleMarkersRef.current[scheduleIndex];
        // 네이버맵 마커 클릭 이벤트 트리거
        window.naver.maps.Event.trigger(marker, 'click');
      }
    } else if (mapType === 'google' && map.current) {
      const location = { lat, lng };
      map.current.panTo(location);
      map.current.setZoom(16);
      
      // 해당 마커의 클릭 이벤트 트리거 (InfoWindow는 마커에서 이미 생성됨)
      if (scheduleIndex !== -1 && scheduleMarkersRef.current[scheduleIndex]) {
        const marker = scheduleMarkersRef.current[scheduleIndex];
        // 구글맵 마커 클릭 이벤트 트리거
        window.google.maps.event.trigger(marker, 'click');
      }
    }
  };

  // 반복일정 정보를 파싱하고 표시하는 함수
  const getRepeatDisplayText = (repeatJson?: string | null): string => {
    if (!repeatJson || repeatJson === 'null' || repeatJson.trim() === '') return '없음';
    try {
      const repeatObj = JSON.parse(repeatJson);
      const r1 = repeatObj.r1;
      const r2 = repeatObj.r2;
      
      switch (r1) {
        case '5':
          return '매년';
        case '4':
          return '매월';
        case '3':
          if (r2) {
            const days = r2.split(',').map((day: string) => {
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              return dayNames[parseInt(day)] || day;
            });
            return `매주 ${days.join(',')}`;
          }
          return '매주';
        case '2':
          return '매일';
        default:
          return '사용자 정의';
      }
    } catch {
      return '없음';
    }
  };

  // 반복일정인지 확인하는 함수
  const isRepeatingSchedule = (schedule: Schedule): boolean => {
    return !!(schedule.sst_repeat_json && schedule.sst_repeat_json.trim() !== '') || !!(schedule.sst_pidx && schedule.sst_pidx > 0);
  };

  // 반복일정 아이콘을 반환하는 함수
  const getRepeatIcon = (schedule: Schedule): string => {
    if (isRepeatingSchedule(schedule)) {
      return '🔄';
    }
    return '';
  };

  // 멤버별 선택된 날짜 스케줄 통계 계산 함수
  const getMemberTodayScheduleStats = (member: GroupMember) => {
    console.log('[getMemberTodayScheduleStats] 시작:', {
      memberName: member.name,
      memberSgdtIdx: member.sgdt_idx,
      selectedDate,
      totalGroupSchedules: groupSchedules.length
    });

    const memberSchedules = (groupSchedules && safeArrayCheck(groupSchedules)) ? groupSchedules.filter(schedule => {
      // sgdt_idx 매칭 확인
      const sgdtMatch = schedule.sgdt_idx !== null && 
        schedule.sgdt_idx !== undefined && 
        Number(schedule.sgdt_idx) === Number(member.sgdt_idx);
      
      // 날짜 매칭 확인 (더 정확한 비교)
      let dateMatch = false;
      if (schedule.date && typeof schedule.date === 'string') {
        try {
          const scheduleDate = new Date(schedule.date);
          const selectedDateObj = new Date(selectedDate);
          const scheduleDateStr = format(scheduleDate, 'yyyy-MM-dd');
          dateMatch = scheduleDateStr === selectedDate;
        } catch (e) {
          // 날짜 형식이 맞지 않으면 문자열로 비교
          dateMatch = schedule.date.startsWith(selectedDate);
        }
      }

      return sgdtMatch && dateMatch;
    }) : [];

    console.log('[getMemberTodayScheduleStats] 필터링된 스케줄:', {
      memberName: member.name,
      filteredCount: memberSchedules.length,
      schedules: memberSchedules.map(s => ({
        id: s.id,
        title: s.title,
        date: s.date,
        statusName: s.statusDetail?.name || 'no-status'
      }))
    });

    const stats = {
      total: memberSchedules.length,
      completed: 0,
      ongoing: 0,
      upcoming: 0
    };

    memberSchedules.forEach(schedule => {
      if (schedule.statusDetail) {
        switch (schedule.statusDetail.name) {
          case 'completed':
            stats.completed++;
            break;
          case 'ongoing':
            stats.ongoing++;
            break;
          case 'upcoming':
            stats.upcoming++;
            break;
        }
      } else {
        console.warn('[getMemberTodayScheduleStats] statusDetail이 없는 스케줄:', schedule);
      }
    });

    console.log('[getMemberTodayScheduleStats] 최종 통계:', {
      memberName: member.name,
      stats
    });

    return stats;
  };

    // 사이드바 토글 함수 (강화된 햅틱 피드백)
    const toggleSidebar = () => {
      const newState = !isSidebarOpen;
      setIsSidebarOpen(newState);
      
      // 햅틱 피드백 - 전용 함수 사용
      if (newState) {
        // 사이드바 열릴 때 - Medium 햅틱 (전용 함수 사용)
        hapticFeedback.homeSidebarOpen({
          trigger: 'button-click',
          page: 'home',
          timestamp: Date.now()
        });
      } else {
        // 사이드바 닫힐 때 - Light 햅틱 (전용 함수 사용)
        hapticFeedback.homeSidebarClose({
          trigger: 'button-click', 
          page: 'home',
          timestamp: Date.now()
        });
      }
    };
  
    // 사이드바 외부 클릭 시 닫기 (강화된 햅틱 피드백)
    useEffect(() => {
      const handleSidebarClickOutside = (event: MouseEvent) => {
        // 플로팅 버튼 클릭 시 사이드바 닫지 않음
        const target = event.target as HTMLElement;
        const floatingButton = document.querySelector('[data-floating-button]') as HTMLElement;
        if (floatingButton && floatingButton.contains(target)) {
          return;
        }
        
        if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
          setIsSidebarOpen(false);
          
          // 외부 클릭으로 사이드바 닫힐 때 햅틱 피드백 (전용 함수 사용)
          hapticFeedback.homeSidebarClose({
            trigger: 'outside-click',
            page: 'home',
            timestamp: Date.now()
          });
        }
      };
  
      if (isSidebarOpen) {
        document.addEventListener('mousedown', handleSidebarClickOutside);
      }
  
      return () => {
        document.removeEventListener('mousedown', handleSidebarClickOutside);
      };
    }, [isSidebarOpen]);

  // 사이드바 애니메이션 variants (모바일 사파리 최적화)
  const sidebarVariants = {
    closed: {
      x: '-100%',
      transition: {
        duration: 0.6
      }
    },
    open: {
      x: 0,
      transition: {
        duration: 0.6
      }
    }
  };

  const sidebarOverlayVariants = {
    closed: {
      opacity: 0,
      transition: {
        duration: 0.6
      }
    },
    open: {
      opacity: 1,
      transition: {
        duration: 0.6
      }
    }
  };

  const sidebarContentVariants = {
    closed: {
      opacity: 0,
      transition: {
        duration: 0.6
      }
    },
    open: {
      opacity: 1,
      transition: {
        duration: 0.6
      }
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

  // 🚨 Critical Error가 있으면 즉시 에러 화면 표시
  if (criticalError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Critical Error</h3>
            <p className="text-sm text-gray-600 mb-4">{criticalError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
            >
              페이지 새로고침
            </button>
            <button 
              onClick={() => setCriticalError(null)}
              className="w-full mt-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              오류 무시하고 계속
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🚨 iOS 시뮬레이터 에러 처리 UI
  if (componentError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">홈 페이지 오류 발생</h3>
            <p className="text-sm text-gray-600 mb-4 break-words">{componentError}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  console.log('[HOME ERROR] 사용자가 앱 재시작 요청');
                  setComponentError(null);
                  window.location.reload();
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                앱 다시 시작
              </button>
              <button 
                onClick={() => {
                  console.log('[HOME ERROR] 사용자가 홈으로 강제 이동 요청');
                  setComponentError(null);
                  window.location.href = '/home';
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                홈으로 강제 이동
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 렌더링 시도 횟수 증가 및 DOM 안전성 체크 (iOS WebView 최적화)
  useEffect(() => {
    try {
      setRenderAttempts(prev => prev + 1);
      console.log('[HOME] 렌더링 시도:', renderAttempts + 1);
      
      // iOS WebView 감지
      const isIOSWebView = typeof window !== 'undefined' && 
                          (window as any).webkit?.messageHandlers;
      
      if (isIOSWebView) {
        console.log('[HOME] iOS WebView 환경 감지 - 최적화 모드');
        // iOS WebView에서는 DOM 준비 체크를 생략하고 빠르게 진행
        setTimeout(() => {
          console.log('[HOME] iOS WebView 최적화 로딩 완료');
        }, 50);
      } else {
        // 일반 브라우저에서는 DOM 준비 확인
        if (typeof window !== 'undefined' && document.readyState === 'complete') {
          console.log('[HOME] DOM 준비 완료');
        }
      }
    } catch (error) {
      console.error('[HOME] 렌더링 초기화 에러:', error);
      setCriticalError(`렌더링 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }, []);

  // 🛡️ 마운트 상태 확인 후 안전한 렌더링
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    // iOS WebView에서 빠른 마운트를 위해 즉시 실행
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 10); // 최소 지연으로 렌더링 차단 방지

    return () => clearTimeout(timer);
  }, []);

  // 마운트되지 않은 상태에서는 최소한의 로딩 화면 표시 (iOS WebView 최적화)
  if (!isMounted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px' }}>로딩 중...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }



  // 🛡️ 안전한 렌더링
  try {
    return (
      <>
        <style jsx global>{mobileStyles}</style>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="min-h-screen relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
            paddingBottom: '76px' // 네비게이션 바를 위한 하단 여백
          }}
          data-react-mount="true"
          data-page="/home"
          id="home-page-container"
        >
        {/* 통일된 헤더 애니메이션 */}
        <AnimatedHeader 
          variant="enhanced"
          className={`fixed top-0 left-0 right-0 glass-effect header-fixed ${isSidebarOpen ? 'z-40' : 'z-50'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3">
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">홈</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들과 실시간으로 소통해보세요</p>
                  </div>
                </div>
              </div>
              
                                            <div className="flex items-center space-x-2">
                <motion.button
                 whileTap={{ scale: 0.98 }}
                 className="p-1 hover:bg-white/50 rounded-xl transition-all duration-200 relative"
                 onClick={async () => {
                   // 알림 페이지로 이동하면서 모든 알림을 읽음 처리
                   try {
                     if (user?.mt_idx && hasNewNotifications) {
                       await notificationService.markAllAsRead(user.mt_idx);
                       console.log('[HOME] 모든 알림 읽음 처리 완료');
                     }
                     setHasNewNotifications(false);
                     router.push('/notice');
                   } catch (error) {
                     console.error('[HOME] 알림 읽음 처리 실패:', error);
                     // 실패해도 페이지는 이동
                     setHasNewNotifications(false);
                     router.push('/notice');
                   }
                 }}
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="gray">
                   <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
                 </svg>
                 {/* 읽지 않은 알림이 있을 때만 빨간색 점 표시 */}
                 {hasNewNotifications && (
                   <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse">
                 </div>
                 )}
               </motion.button>
               
               {/* 햅틱 테스트 버튼 (개발 환경에서만 표시) */}
               {process.env.NODE_ENV === 'development' && (
                 <motion.button
                   whileHover={{ scale: 1.02 }}
                   whileTap={{ scale: 0.98 }}
                   className="p-1 hover:bg-white/50 rounded-xl transition-all duration-200"
                   onClick={() => {
                     triggerHapticFeedback(HapticFeedbackType.LIGHT, '햅틱 테스트 페이지 이동', { 
                       component: 'home', 
                       action: 'test-page-navigation' 
                     });
                     router.push('/test-haptic');
                   }}
                   title="햅틱 테스트"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="gray" strokeWidth="2">
                     <path d="M9 12l2 2 4-4"/>
                     <path d="M21 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z"/>
                     <path d="M3 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z"/>
                     <path d="M12 21c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z"/>
                     <path d="M12 3c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z"/>
                   </svg>
                 </motion.button>
               )}
               
               <motion.button
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 className="p-1 hover:bg-white/50 rounded-xl transition-all duration-200"
                 onClick={() => {
                   // 🎮 설정 페이지 이동 햅틱 피드백
                   triggerHapticFeedback(HapticFeedbackType.SELECTION, '설정 페이지 이동', { 
                     component: 'home', 
                     action: 'navigate-to-setting' 
                   });
                   router.push('/setting');
                 }}
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="gray">
                   <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.570.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                 </svg>
               </motion.button>
             </div>
            </div>
          </AnimatedHeader>

        {/* 🚨 iOS 시뮬레이터 디버깅 패널 (개발 환경에서만 표시) */}
        {/* {process.env.NODE_ENV === 'development' && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            className="fixed top-20 left-4 z-50 bg-white/90 backdrop-blur-sm rounded-lg p-3 max-w-xs shadow-lg border"
          >
                         <div className="text-xs font-mono space-y-1">
               <div className="font-bold text-blue-600">🔧 iOS 디버깅 상태</div>
               <div>인증: {authLoading ? '⏳ 로딩중' : isLoggedIn ? '✅ 완료' : '❌ 실패'}</div>
               <div>프리로딩: {isPreloadingComplete ? '✅ 완료' : '🚀 백그라운드'}</div>
               <div>사용자: {user?.mt_name || userInfo?.name || '❌ 없음'}</div>
               <div>Auth그룹: {user?.groups?.length || 0}개 {(user?.groups?.length || 0) > 0 ? '✅' : '❌'}</div>
               <div>User그룹: {userGroups.length}개 {userGroups.length > 0 ? '✅' : '❌'}</div>
               <div>Local그룹: {(() => {
                 try {
                   const storedGroups = typeof window !== 'undefined' ? localStorage.getItem('user_groups') : null;
                   const groups = storedGroups ? JSON.parse(storedGroups) : [];
                   return (groups && safeArrayCheck(groups)) ? groups.length : 0;
                 } catch {
                   return 0;
                 }
               })()}개 {(() => {
                 try {
                   const storedGroups = typeof window !== 'undefined' ? localStorage.getItem('user_groups') : null;
                   const groups = storedGroups ? JSON.parse(storedGroups) : [];
                   return (groups && safeArrayCheck(groups) && groups.length > 0) ? '✅' : '❌';
                 } catch {
                   return '❌';
                 }
               })()}</div>
               <div>선택그룹: {selectedGroupId ? `✅ ${selectedGroupId}` : '❌ 없음'}</div>
               <div>멤버: {groupMembers.length}명 {groupMembers.length > 0 ? '✅' : '❌'}</div>
               <div>지도: {mapType} {isMapLoading ? '⏳' : '✅'}</div>
               <div>위치: {isLocationEnabled ? '✅' : '❌'}</div>
               <div>UserContext: {isUserDataLoading ? '⏳' : userGroups.length > 0 ? '✅' : '❌'}</div>
               {componentError && (
                 <div className="text-red-600 font-bold">에러: {componentError}</div>
               )}
             </div>
          </motion.div>
        )} */}

        {/* 지도 영역 (화면 100% 차지, fixed 포지션으로 고정) */}
        <div 
          className="full-map-container" 
          style={{ 
            paddingTop: '0px',
            position: 'relative',
            touchAction: 'manipulation',
            overflow: 'visible'
          }}
        >
          {/* 스켈레톤 UI - 지도 로딩 중일 때 표시 */}
          {isMapLoading && (
            <MapSkeleton 
              showControls={true} 
              showMemberList={false}
              className="absolute top-0 left-0 w-full h-full z-5" 
            />
          )}

          <div 
            ref={googleMapContainer} 
            className="w-full h-full absolute top-0 left-0" 
            style={{ display: mapType === 'google' ? 'block' : 'none', zIndex: 6 }}
          ></div>
          <div 
            ref={naverMapContainer} 
            className="w-full h-full absolute top-0 left-0" 
            style={{ display: mapType === 'naver' ? 'block' : 'none', zIndex: 6 }}
          ></div>
        </div>
        
        {/* 커스텀 줌 컨트롤 */}
        {((mapType === 'naver' && naverMap.current) || (mapType === 'google' && map.current)) && (
          <div className="absolute top-[70px] right-[10px] z-30 flex flex-col">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (mapType === 'naver' && naverMap.current) {
                  const currentZoom = naverMap.current.getZoom();
                  naverMap.current.setZoom(currentZoom + 1);
                } else if (mapType === 'google' && map.current) {
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
                if (mapType === 'naver' && naverMap.current) {
                  const currentZoom = naverMap.current.getZoom();
                  naverMap.current.setZoom(currentZoom - 1);
                } else if (mapType === 'google' && map.current) {
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
        
        {/* 지도 컨트롤 버튼들 - 바텀시트 상태에 따라 위치 변경 */}
        {/* <div className={`${getControlsClassName()} map-controls`}>
            <button 
              onClick={() => updateMapPosition()}
              className="map-control-button"
              aria-label="내 위치로 이동"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
            </button>
                      </div> */}

         {/* 플로팅 사이드바 토글 버튼 - 네비게이션 바 오른쪽 아래 */}
         <motion.button
           initial={{ y: 100, opacity: 0, scale: 0.8 }}
           animate={{ 
             y: -80, 
             opacity: 1, 
             scale: 1,
             transition: {
               delay: 0.2,
               type: "spring",
               stiffness: 120,
               damping: 25,
               duration: 1.0
             }
           }}
           whileHover={{ 
             scale: 1.1,
             y: -2,
             transition: { duration: 0.2 }
           }}
           whileTap={{ scale: 0.9 }}
           onClick={(e) => {
             e.stopPropagation(); // 이벤트 전파 방지
             console.log('플로팅 버튼 클릭됨, 현재 사이드바 상태:', isSidebarOpen);
             toggleSidebar();
           }}
           className="fixed bottom-36 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
           data-floating-button="true"
           style={{
             background: '#0113A3',
             boxShadow: '0 8px 25px rgba(1, 19, 163, 0.3)',
             zIndex: 999999, // 사이드바보다 훨씬 높은 z-index
             position: 'fixed',
             pointerEvents: 'auto' // 항상 클릭 가능하도록 설정
           }}
         >
           {isSidebarOpen ? (
             // 닫기 아이콘 (X)
             <svg className="w-6 h-6 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           ) : (
             // 그룹 멤버 아이콘 (채워진 스타일)
             <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
               <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157l.001.003Z" />
             </svg>
           )}
           
           {/* 알림 배지 (그룹멤버 수) */}
           {groupMembers.length > 0 && !isSidebarOpen && (
             <motion.div
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center"
             >
               <span className="text-xs font-bold text-white">{groupMembers.length}</span>
             </motion.div>
           )}
           
           {/* 펄스 효과 */}
           {!isSidebarOpen && (
             <motion.div
               className="absolute inset-0 rounded-full"
               style={{ background: '#0113A3' }}
               animate={{
                 scale: [1, 1.4, 1],
                 opacity: [0.6, 0, 0.6]
               }}
               transition={{
                 duration: 2.5,
                 repeat: Infinity,
                 ease: "easeInOut"
               }}
             />
           )}
         </motion.button>

         {/* 바텀시트 제거됨 */}

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
                 className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99995]"
                 onClick={(e) => {
                   // 플로팅 버튼 영역 클릭 시 사이드바 닫지 않음
                   const target = e.target as HTMLElement;
                   const floatingButton = document.querySelector('[data-floating-button]') as HTMLElement;
                   if (floatingButton && floatingButton.contains(target)) {
                     return;
                   }
                   setIsSidebarOpen(false);
                 }}
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
                   className="fixed left-0 top-0 w-80 shadow-2xl border-r z-[99997] flex flex-col"
                   onClick={(e) => e.stopPropagation()}
                   style={{ 
                     background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
                     borderColor: 'rgba(1, 19, 163, 0.1)',
                     height: 'calc(100vh - 40px)',
                     // 모바일 사파리 최적화
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
                     className="p-6 h-full flex flex-col relative z-10"
                     onClick={(e) => e.stopPropagation()}
                     style={{
                       paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
                       paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)'
                     }}
                   >


                   {/* 개선된 헤더 */}
                   <div 
                     className="flex items-center justify-between mb-6"
                     onClick={(e) => e.stopPropagation()}
                   >
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
                   </div>

                   {/* 그룹 목록 섹션 */}
                   <div className="mb-5">
                     <div className="flex items-center space-x-2 mb-3">
                                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0113A3' }}></div>
                       <h3 className="text-base font-semibold text-gray-800">그룹 목록</h3>
                     </div>
                     
                     <div className="relative">
                       <GroupSelector
                        userGroups={userGroups}
                        selectedGroupId={selectedGroupId}
                        isGroupSelectorOpen={isGroupSelectorOpen}
                        groupMemberCounts={groupMemberCounts}
                        onOpen={() => setIsGroupSelectorOpen(true)}
                        onClose={() => setIsGroupSelectorOpen(false)}
                        onGroupSelect={(groupId) => {
                          if (selectedGroupId !== groupId) {
                            handleGroupSelect(groupId);
                          }
                        }}
                      />
                     </div>
                   </div>

                   {/* 날짜 선택 섹션 */}
                   <div className="mb-5">
                     <div className="flex items-center space-x-2 mb-3">
                       <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                       <h3 className="text-base font-semibold text-gray-800">날짜 선택</h3>
                     </div>
                     <div className="relative overflow-hidden rounded-xl bg-white/60 backdrop-blur-sm p-3 border" style={{ borderColor: 'rgba(1, 19, 163, 0.1)' }}>
                       <motion.div
                         className="flex space-x-2 cursor-grab active:cursor-grabbing"
                         style={{ 
                           x: sidebarDateX,
                           touchAction: 'pan-x'
                         }}
                         drag="x"
                         dragConstraints={{
                           left: -(Math.max(0, (daysForCalendar.length * 76) - 240)),
                           right: 0
                         }}
                         data-calendar-swipe="true"
                         onDragStart={() => {
                           sidebarDraggingRef.current = true;
                           console.log('📅 [Sidebar Calendar] Drag Start');
                         }}
                         onDragEnd={(e, info) => {
                           console.log('📅 [Sidebar Calendar] Drag End - offset:', info.offset.x, 'velocity:', info.velocity.x);
                           setTimeout(() => { sidebarDraggingRef.current = false; }, 50);

                           const swipeThreshold = 50;
                           const velocityThreshold = 200;

                           let shouldChangeDate = false;
                           let direction: 'prev' | 'next' | null = null;

                           // 스와이프 거리나 속도로 날짜 변경 판단
                           if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                             direction = 'next';
                             shouldChangeDate = true;
                           } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                             direction = 'prev';
                             shouldChangeDate = true;
                           }

                           if (shouldChangeDate && direction) {
                             const currentIndex = (daysForCalendar && safeArrayCheck(daysForCalendar)) 
                             ? daysForCalendar.findIndex(day => day.value === selectedDate)
                             : -1;
                             
                             if (direction === 'next' && currentIndex < daysForCalendar.length - 1) {
                               handleDateSelect(daysForCalendar[currentIndex + 1].value);
                               console.log('📅 [Sidebar] 다음 날짜로 변경:', daysForCalendar[currentIndex + 1].value);
                             } else if (direction === 'prev' && currentIndex > 0) {
                               handleDateSelect(daysForCalendar[currentIndex - 1].value);
                               console.log('📅 [Sidebar] 이전 날짜로 변경:', daysForCalendar[currentIndex - 1].value);
                             }

                             // 햅틱 피드백
                             try {
                               if ('vibrate' in navigator) {
                                 navigator.vibrate([15]);
                               }
                             } catch (err) {
                               console.debug('햅틱 차단');
                             }
                           }

                           // 원래 위치로 복원
                           sidebarDateX.set(0);
                         }}
                       >
                         {(daysForCalendar && safeArrayCheck(daysForCalendar)) ? daysForCalendar.map((day, index) => (
                           <motion.button
                             key={day.value}
                             whileHover={{ scale: 1.05 }}
                             whileTap={{ scale: 0.95 }}
                             onClick={() => {
                               // 햅틱 피드백
                               try {
                                 if ('vibrate' in navigator) {
                                   navigator.vibrate([10]);
                                 }
                               } catch (err) {
                                 console.debug('햅틱 피드백 차단');
                               }
                               handleDateSelect(day.value);
                             }}
                             data-calendar-swipe="true"
                             className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-normal transition-all duration-300 min-w-[75px] focus:outline-none ${
                               selectedDate === day.value
                                 ? 'text-white shadow-lg scale-105'
                                 : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md hover:scale-102 border'
                             }`}
                             style={selectedDate === day.value 
                               ? { backgroundColor: '#0113A3' }
                               : { borderColor: 'rgba(1, 19, 163, 0.1)' }
                             }
                           >
                             {day.display}
                           </motion.button>
                         )) : []}
                       </motion.div>
                     </div>
                   </div>

                   {/* 그룹 멤버 목록 */}
                   <div className="flex-1 min-h-0">
                     <div className="flex items-center space-x-2 mb-4">
                       <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                       <h3 className="text-base font-semibold text-gray-800">멤버 목록</h3>
                       <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/50 to-transparent"></div>
                       <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full backdrop-blur-sm">
                         {groupMembers ? groupMembers.length : 0}명
                       </span>
                     </div>
                     <div className="h-full overflow-y-auto hide-scrollbar space-y-3 pb-24">
                       {groupMembers && safeArrayCheck(groupMembers) && groupMembers.length > 0 ? (
                         <motion.div variants={sidebarContentVariants} className="space-y-2">
                           {(groupMembers && safeArrayCheck(groupMembers)) && groupMembers.map((member, index) => {
                             const stats = getMemberTodayScheduleStats(member);
                             return (
                               <motion.div
                                                                    key={member.id}
                                   variants={memberItemVariants}
                                   whileTap={{ scale: 0.98 }}
                                 onClick={() => {
                                   handleMemberSelect(member.id);
                                   setIsSidebarOpen(false); // 멤버 선택 후 사이드바 닫기
                                 }}
                                 className={`p-4 rounded-xl cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                                   member.isSelected 
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
                                       className={`w-12 h-12 rounded-full overflow-hidden ${
                                         member.isSelected 
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
                                       src={getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}
                                       alt={member.name} 
                                       className="w-full h-full object-cover" 
                                       onError={(e) => {
                                         const target = e.target as HTMLImageElement;
                                         target.src = getDefaultImage(member.mt_gender, member.original_index);
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
                                         {/* 오늘 총 스케줄 수 */}
                                         <div className="flex items-center space-x-1">
                                           <span className="text-xs text-gray-500">📅</span>
                                           <span className={`text-xs font-normal ${
                                             member.isSelected ? 'text-gray-700' : 'text-gray-700'
                                           }`}>
                                             {stats.completed + stats.ongoing + stats.upcoming}개
                                           </span>
                                         </div>
                                       </div>
                                       {/* 스케줄 통계 표시 */}
                                       <div className="flex items-center space-x-3">
                                         <div className="flex items-center space-x-1" title="완료된 스케줄">
                                           <span className="text-xs text-gray-500">완료</span>
                                           <span className="text-xs font-medium text-green-600">{stats.completed}</span>
                                         </div>
                                         <div className="flex items-center space-x-1" title="진행 중인 스케줄">
                                           <span className="text-xs text-gray-500">진행중</span>
                                           <span className="text-xs font-medium text-orange-600">{stats.ongoing}</span>
                                         </div>
                                         <div className="flex items-center space-x-1" title="예정된 스케줄">
                                           <span className="text-xs text-gray-500">예정</span>
                                           <span className="text-xs font-medium text-blue-600">{stats.upcoming}</span>
                                         </div>
                                       </div>

                                   </div>
                                   {/* {member.isSelected && (
                                     <div className="flex-shrink-0">
                                       <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#0113A3' }}></div>
                                     </div>
                                   )} */}
                                 </div>
                               </motion.div>
                             );
                           })}
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
              </motion.div>
      </>
    );
  } catch (renderError) {
    console.error('🏠 [HOME] 렌더링 오류:', renderError);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">렌더링 오류</h3>
            <p className="text-sm text-gray-600 mb-4">
              {renderError instanceof Error ? renderError.message : String(renderError)}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              브라우저 콘솔을 확인해주세요.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
            >
              페이지 새로고침
            </button>
            <button 
              onClick={() => window.location.href = '/signin'}
              className="w-full mt-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }
}