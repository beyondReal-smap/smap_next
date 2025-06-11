'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import { PageContainer, Button } from '../components/layout';
import { FiPlus, FiTrendingUp, FiClock, FiZap, FiPlayCircle, FiSettings, FiUser, FiLoader, FiChevronDown, FiActivity } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_KEYS, MAP_CONFIG } from '../../config'; 
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import memberService from '@/services/memberService';

import groupService, { Group } from '@/services/groupService';
import memberLocationLogService, { LocationLog, LocationSummary as APILocationSummary, LocationPathData, DailySummary, StayTime, MapMarker, LocationLogSummary, DailyCountsResponse, MemberActivityResponse, MemberDailyCount } from '@/services/memberLocationLogService';
import ErrorDisplay from './components/ErrorDisplay';
import ErrorToast from './components/ErrorToast';

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
    gradientPolylines?: any[];
    getRecentDaysDebugLogged?: boolean;
    // google: any; // google은 logs 페이지에서 아직 사용하지 않으므로 주석 처리 또는 필요시 추가
  }
}

const NAVER_MAPS_CLIENT_ID = API_KEYS.NAVER_MAPS_CLIENT_ID;

// --- home/page.tsx에서 가져온 인터페이스 및 데이터 시작 ---
interface Location { // home/page.tsx의 Location 인터페이스 (필요시 logs의 기존 LocationData와 병합/조정)
  lat: number;
  lng: number;
}



interface GroupMember {
  id: string; name: string; photo: string | null; isSelected: boolean; location: Location;
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

// pageStyles with section styles from home/page.tsx
// 사이드바 애니메이션 variants
const sidebarVariants = {
  closed: {
    x: '-100%',
    transition: {
      type: 'tween',
      ease: [0.25, 0.46, 0.45, 0.94],
      duration: 0.4
    }
  },
  open: {
    x: 0,
    transition: {
      type: 'tween',
      ease: [0.25, 0.46, 0.45, 0.94],
      duration: 0.4
    }
  }
};

const sidebarOverlayVariants = {
  closed: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeInOut"
    }
  }
};

const sidebarContentVariants = {
  closed: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.06
    }
  }
};

const memberItemVariants = {
  closed: { 
    opacity: 0, 
    x: -15,
    scale: 0.95
  },
  open: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: {
      type: "tween",
      ease: [0.25, 0.46, 0.45, 0.94],
      duration: 0.3
    }
  }
};

const pageStyles = `
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
  animation: slideUp 1s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 1s ease-out forwards;
}

/* glass-effect 스타일 추가 */
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
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

.logs-section {
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



@media (max-width: 640px) {
  .member-avatar {
    width: 48px; 
    height: 48px; 
  }
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
      ease: [0.22, 1, 0.36, 1]
    }
  },
  out: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

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

// Helper 함수들 추가 (home/page.tsx에서 가져옴)
const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/';

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

// SSL 인증서 오류가 있는 URL인지 확인하는 함수 (home/page.tsx와 동일)
// 안전한 이미지 URL을 반환하는 함수 - location/home과 동일한 로직
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  // 실제 사진이 있으면 사용하고, 없으면 기본 이미지 사용
  return photoUrl ?? getDefaultImage(gender, index);
};

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

// 전역 실행 제어 - 한 번만 실행되도록 보장
let globalPageExecuted = false;
let globalComponentInstances = 0;

export default function LogsPage() {
  const router = useRouter();
  
  // 인증 관련 상태 추가 (home/page.tsx와 동일)
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  // UserContext 사용
  const { userInfo, userGroups, isUserDataLoading, userDataError, refreshUserData } = useUser();
  // DataCacheContext 사용
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
  
  // home/page.tsx와 동일한 상태들 추가
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);

  
  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  
  // 데이터 fetch 상태 관리
  const dataFetchedRef = useRef<{ members: boolean; dailyCounts: boolean }>({ members: false, dailyCounts: false });
  
  // 컴포넌트 인스턴스별 실행 제어
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const hasExecuted = useRef(false);
  const isMainInstance = useRef(false);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
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
  const arrowMarkers = useRef<any[]>([]); // 화살표 마커들을 저장할 배열 추가
    const currentPositionMarker = useRef<any>(null); // 슬라이더 현재 위치 마커를 위한 ref
  const sliderRef = useRef<HTMLDivElement>(null); // 슬라이더 요소를 위한 ref
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); 
  const [isMapInitializedLogs, setIsMapInitializedLogs] = useState(false); // Logs 페이지용 지도 초기화 상태
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false); // 초기 데이터 로딩 상태 추가

  // 첫 진입 애니메이션 상태 관리
  const [showHeader, setShowHeader] = useState(true);
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
  
  // 멤버별 로그 분포 상태 (14일간의 활동 여부)
  const [memberLogDistribution, setMemberLogDistribution] = useState<Record<string, boolean[]>>({});
  
  const [sliderValue, setSliderValue] = useState(0); // 슬라이더 초기 값 (0-100) - 시작은 0으로
  const [sortedLocationData, setSortedLocationData] = useState<MapMarker[]>([]); // 정렬된 위치 로그 데이터
  const [isSliderDragging, setIsSliderDragging] = useState(false); // 슬라이더 드래그 중인지 확인
  
  // 초기 진입 감지 플래그
  const [isInitialEntry, setIsInitialEntry] = useState(true);
  
  // 에러 상태 관리
  const [dataError, setDataError] = useState<{
    type: 'network' | 'no_data' | 'unknown';
    message: string;
    retryable: boolean;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const dateScrollContainerRef = useRef<HTMLDivElement>(null); // 날짜 스크롤 컨테이너 Ref 추가

  // 에러 처리 헬퍼 함수
  const handleDataError = (error: any, context: string) => {
    console.error(`[${context}] 데이터 로딩 오류:`, error);
    
    let errorType: 'network' | 'no_data' | 'unknown' = 'unknown';
    let errorMessage = '데이터를 불러오는 중 오류가 발생했습니다.';
    let retryable = true;

    if (error?.response?.status === 404) {
      errorType = 'no_data';
      errorMessage = '해당 날짜의 데이터가 없습니다.';
      retryable = false;
    } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
      errorType = 'network';
      errorMessage = '네트워크 연결을 확인해주세요.';
      retryable = true;
    } else if (error?.response?.status >= 500) {
      errorType = 'network';
      errorMessage = '서버에 일시적인 문제가 발생했습니다.';
      retryable = true;
    }

    setDataError({
      type: errorType,
      message: errorMessage,
      retryable
    });
  };

  // 재시도 함수
  const retryDataLoad = async () => {
    if (retryCount >= maxRetries) {
      console.log('[RETRY] 최대 재시도 횟수 초과');
      return;
    }

    setRetryCount(prev => prev + 1);
    setDataError(null);
    
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember && selectedDate) {
      console.log(`[RETRY] 데이터 재시도 (${retryCount + 1}/${maxRetries}):`, selectedMember.name, selectedDate);
      await loadLocationData(parseInt(selectedMember.id), selectedDate);
    }
  };



  // 초기 데이터 로딩 시뮬레이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialDataLoaded(true);
    }, 1000); // 1초 후 초기 데이터 로딩 완료

    return () => clearTimeout(timer);
  }, []);

  // 첫 진입 시 헤더는 계속 유지
  useEffect(() => {
    if (isInitialDataLoaded && !isMapLoading && isMapInitializedLogs) {
      // 헤더는 계속 표시 상태로 유지
      setShowHeader(true);
      setShowDateSelection(true);
    }
  }, [isInitialDataLoaded, isMapLoading, isMapInitializedLogs]);

  const loadNaverMapsAPI = () => {
    if (window.naver?.maps) {
      setNaverMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'naver-maps-script-logs'; // 스크립트 ID 변경 (다른 페이지와 충돌 방지)
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAPS_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Naver Maps API loaded for LogsPage.');
      setNaverMapsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Naver Maps API for LogsPage.');
      setIsMapLoading(false);
    };
    const existingScript = document.getElementById('naver-maps-script-logs');
    if (!existingScript) {
      document.head.appendChild(script);
    }
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

  useEffect(() => {
    loadNaverMapsAPI();
  }, []);

  useEffect(() => {
    if (naverMapsLoaded && mapContainer.current && !map.current && groupMembers.length > 0) {
      setIsMapLoading(true);
      try {
        // 첫 번째 멤버의 위치로 초기 중심점 설정
        const firstMember = groupMembers[0];
        const initialLat = firstMember.mlt_lat || firstMember.location.lat || 37.5665;
        const initialLng = firstMember.mlt_long || firstMember.location.lng || 126.9780;
        const initialCenter = new window.naver.maps.LatLng(initialLat, initialLng);
        
        console.log('[지도 초기화] 첫 번째 멤버 위치로 초기화:', {
          memberName: firstMember.name,
          lat: initialLat,
          lng: initialLng
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
            console.log('Naver Map initialized for LogsPage with member location');
            setIsMapLoading(false);
            setIsMapInitializedLogs(true); // 지도 초기화 완료 상태 설정
            if(map.current) map.current.refresh(true);
        });
      } catch (error) {
        console.error('Naver Maps 초기화 중 오류(LogsPage):', error);
        setIsMapLoading(false);
      }
    }
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
      
      // 선택된 멤버 찾기
      const selectedMember = groupMembers.find(m => m.isSelected);
      
      // 실제 데이터에서 해당 날짜의 로그 개수 확인
      let hasLogs = false;
      let dayCount = 0;
      let dayData = null;
      
      if (dailyCountsData && selectedMember) {
        // mt_idx 기준으로 멤버 데이터 찾기
        const memberMtIdx = parseInt(selectedMember.id);
        const memberData = dailyCountsData.member_daily_counts.find(
          member => member.member_id === memberMtIdx
        );
        
        if (memberData) {
          // 날짜 형식 맞추기: 2025-06-06 -> 06.06
          const shortDateString = format(date, 'MM.dd');
          
          dayData = memberData.daily_counts.find(
            day => day.formatted_date === shortDateString || day.formatted_date === dateString
          );
          if (dayData) {
            dayCount = dayData.count;
            hasLogs = dayCount > 0;
          }
        }
      } else {
        // dailyCountsData가 없거나 선택된 멤버가 없는 경우 MOCK_LOGS 사용
        hasLogs = MOCK_LOGS.some(log => log.timestamp.startsWith(dateString));
      }
      
      let displayString = format(date, 'MM.dd(E)', { locale: ko }); // 예: "05.07(수)"
      
      if (i === 13) {
        displayString = `오늘(${format(date, 'E', { locale: ko })})`;
      } else if (i === 12) {
        displayString = `어제(${format(date, 'E', { locale: ko })})`;
      } 

      return {
        value: dateString,
        display: displayString,
        hasLogs: hasLogs,
        count: dayCount,
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

  // 사이드바 날짜 선택 부분 초기 스크롤 설정
  useEffect(() => {
    if (isSidebarOpen && dateScrollContainerRef.current) {
      // 사이드바가 열리고 DOM이 렌더링된 후 오늘 날짜로 스크롤
      const timer = setTimeout(() => {
        scrollToTodayDate('사이드바 날짜 초기화');
      }, 100);
      
      return () => clearTimeout(timer);
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

    // 좌우 스와이프: 탭 전환 (home/page.tsx와 동일한 로직)
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

      // 좌우 스와이프는 더 이상 지원하지 않음 (단일 탭)
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

  const handleMemberSelect = (id: string, e?: React.MouseEvent | null) => {
    // 이벤트 전파 중단 (이벤트 객체가 유효한 경우에만)
    if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    }
    if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
    }
    
    // 이벤트가 null인 경우는 자동 선택, 있는 경우는 사용자 선택
    const isUserManualSelection = e !== null && e !== undefined;
    
    console.log('Member selection started:', id, isUserManualSelection ? '(사용자 선택)' : '(자동 선택)');
    
    // 멤버 선택 시 모든 요청 취소 및 상태 완전 초기화
    console.log('[handleMemberSelect] 멤버 선택 - 모든 요청 취소 및 상태 초기화 시작');
    
    // 모든 진행 중인 요청 강제 취소 (더 확실한 취소 처리)
    if (loadLocationDataExecutingRef.current.executing) {
      console.log(`[handleMemberSelect] 진행 중인 요청 취소: ${loadLocationDataExecutingRef.current.currentRequest}`);
      loadLocationDataExecutingRef.current.cancelled = true;
      loadLocationDataExecutingRef.current.executing = false;
      loadLocationDataExecutingRef.current.currentRequest = undefined;
    }
    
    // 즉시 지도 초기화 (위치 로그만 제거, 멤버 마커는 보존, 요청은 취소)
    clearMapMarkersAndPaths(false, true);
    
    // 추가로 경로 제거 재확인
    if (locationLogPolyline.current) {
      locationLogPolyline.current.setMap(null);
      locationLogPolyline.current = null;
      console.log('[handleMemberSelect] 경로 추가 제거 완료');
    }
    
    // 위치기록 요약 즉시 초기화
    setLocationSummary(DEFAULT_LOCATION_SUMMARY);
    console.log('[handleMemberSelect] 위치기록 요약 초기화 완료');
    
    // 지도 강제 새로고침
    if (map.current) {
      map.current.refresh(true);
      setTimeout(() => {
        if (map.current) {
          map.current.refresh(true);
          console.log('[handleMemberSelect] 지도 이중 새로고침 완료');
        }
      }, 100);
    }
    
    console.log('[handleMemberSelect] 멤버 선택으로 지도 초기화 완료');
    
    // 다른 멤버 선택 시 해당 멤버의 최근 활동 날짜로 변경
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    const isChangingMember = !currentSelectedMember || currentSelectedMember.id !== id;
    const isSameMemberReselection = currentSelectedMember && currentSelectedMember.id === id;
    
    let targetDate = selectedDate;
    
    if (isChangingMember) {
      // 항상 현재 선택된 날짜를 유지 (최근 활동 날짜로 변경하지 않음)
      targetDate = selectedDate;
      console.log('[handleMemberSelect] 멤버 변경 시 현재 선택된 날짜 유지:', selectedDate);
      
      // 사용자 날짜 선택 플래그가 설정되어 있다면 리셋
      if (isUserDateSelectionRef.current) {
        setTimeout(() => {
          isUserDateSelectionRef.current = false;
          console.log('[handleMemberSelect] 사용자 날짜 선택 플래그 리셋 (지연)');
        }, 2000);
      }
    }
    
    // 멤버 재선택 시 모든 플래그 리셋 (지도 조정 허용)
    if (isDateChangedRef.current) {
      isDateChangedRef.current = false;
      console.log('[handleMemberSelect] 멤버 재선택으로 날짜 변경 플래그 리셋');
    }
    
    // 자동 재생성 방지 플래그도 리셋
    if (isDateChangingRef.current) {
      isDateChangingRef.current = false;
      console.log('[handleMemberSelect] 멤버 재선택으로 자동 재생성 방지 플래그 리셋');
    }
    

    
    const updatedMembers = groupMembers.map(member => {
      const isSelected = member.id === id;
      console.log(`Updating member ${member.name}: isSelected = ${isSelected}`);
      return {
        ...member,
        isSelected: isSelected
      };
    });
    
    console.log('Updated members:', updatedMembers);
    
    setGroupMembers(updatedMembers);
    // updateMemberMarkers는 useEffect에서 처리되도록 제거
    // setActiveLogView('members'); // 이제 summary만 사용하므로 제거
    
    // 멤버 선택 시 날짜 스크롤 위치 조정 - 현재 선택된 날짜 유지
    if (isChangingMember) {
      setTimeout(() => scrollToSelectedDate(selectedDate, '멤버 선택 - 현재 날짜 유지'), 100);
    } else {
      setTimeout(() => scrollToSelectedDate(selectedDate, '멤버 재선택 - 현재 날짜 유지'), 100);
    }
    

    
    // 선택 상태 변경 확인을 위한 로그
    const selectedMember = updatedMembers.find(m => m.isSelected);
    console.log('[handleMemberSelect] Selected member:', selectedMember?.name);
    
    // 사용자 수동 선택일 때만 데이터 로딩
    if (selectedMember && isUserManualSelection) {
      // 같은 멤버 재선택이 아닌 경우에만 로딩 상태 표시
      if (!isSameMemberReselection) {
        setIsLocationDataLoading(true); // 데이터 로딩 직전에 로딩 상태 설정
        console.log('[handleMemberSelect] 새로운 멤버 선택 - 로딩 상태 활성화');
      } else {
        console.log('[handleMemberSelect] 같은 멤버 재선택 - 로딩 상태 건너뜀');
      }
      
      // 새로운 요청 시작 전에 취소 플래그 리셋
      loadLocationDataExecutingRef.current.cancelled = false;
      loadLocationDataExecutingRef.current.executing = false;
      
      // 통합 지도 설정 및 위치 데이터 로딩
      setTimeout(async () => {
        if (selectedMember && map.current) {
          console.log('[handleMemberSelect] 선택된 멤버 기반 통합 지도 설정 시작:', selectedMember.name);
          await loadLocationDataWithMapPreset(parseInt(id), targetDate, selectedMember, isChangingMember);
        }
      }, 100); // 상태 업데이트 대기
    } else if (selectedMember && !isUserManualSelection) {
      console.log('[handleMemberSelect] 자동 선택 - 데이터 로딩 건너뜀 (사용자 액션 대기)');
    }
    
    console.log('[handleMemberSelect] 멤버 선택 완료');
  };

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
  const clearMapMarkersAndPaths = (clearMemberMarkers: boolean = false, cancelPendingRequests: boolean = true) => {
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

    // 8. 멤버 마커들 완전 정리 (선택적 - 날짜 변경 시에만)
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
    setMapMarkersData([]);
    setLocationLogSummaryData(null);
    // setLocationSummary(DEFAULT_LOCATION_SUMMARY); // 자동 초기화 제거 - handleMemberSelect/handleDateSelect에서만 처리
    setSortedLocationData([]);
    setSliderValue(0);
    setIsSliderDragging(false);
    
    // 10. 지도 강력 새로고침 (삼중 새로고침)
    if (map.current) {
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
    }
    
    console.log('[clearMapMarkersAndPaths] ===== 완전 초기화 완료 =====');
  };

  const handleDateSelect = (date: string) => {
    console.log('[LOGS] ===== 날짜 선택 시작 =====');
    console.log('[LOGS] 호출자:', new Error().stack?.split('\n')[1]); // 호출 경로 추적
    console.log('[LOGS] 새 날짜:', date, '현재 날짜:', selectedDate);
    
    // 사용자가 직접 날짜를 선택했음을 표시
    isUserDateSelectionRef.current = true;
    console.log('[handleDateSelect] 사용자 직접 날짜 선택 플래그 ON');
    
    // 현재 선택된 멤버 정보 확인 (활동 캘린더에서 전달받은 멤버 정보 우선 사용)
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    const currentMemberId = currentSelectedMember?.id || null;
    const hasCurrentData = currentLocationLogs.length > 0 || mapMarkersData.length > 0;
    const isSameDate = selectedDate === date;
    const isSameMember = lastLoadedMemberRef.current === currentMemberId;
    
    console.log('[LOGS] 선택 상황 분석:', { 
      newDate: date, 
      currentDate: selectedDate, 
      isSameDate,
      currentMember: currentSelectedMember?.name,
      currentMemberId,
      lastLoadedMember: lastLoadedMemberRef.current,
      isSameMember,
      hasCurrentData
    });
    
    // 같은 날짜 + 같은 멤버 + 데이터 있음 → 무시
    if (isSameDate && isSameMember && hasCurrentData) {
      console.log('[LOGS] 같은 날짜 + 같은 멤버 + 데이터 있음 - 무시');
      return;
    }
    
    // 같은 날짜지만 다른 멤버이거나 데이터가 없으면 재로딩
    if (isSameDate && (!isSameMember || !hasCurrentData)) {
      console.log('[LOGS] 같은 날짜지만 다른 멤버이거나 데이터 없음 - 재로딩');
    }
    
    console.log('[LOGS] 날짜 변경 - 완전 초기화 후 재생성');
    
    // 1. 날짜 변경 중 플래그 설정 (자동 재생성 방지)
    isDateChangingRef.current = true;
    console.log('[handleDateSelect] 자동 재생성 방지 플래그 ON');
    
    // 2. 모든 것을 완전히 지우기 (날짜 변경 시에는 멤버 마커도 제거)
    clearMapMarkersAndPaths(true);
    
    // 3. 추가 상태 초기화 (확실히 하기 위해)
    // setActiveLogView('members'); // 이제 summary만 사용하므로 제거
    setFirstMemberSelected(false);
    isDateChangedRef.current = true;
    // 날짜 변경 시에만 로딩 상태 표시
    setIsLocationDataLoading(true);
    
    // 위치기록 요약 즉시 초기화
    setLocationSummary(DEFAULT_LOCATION_SUMMARY);
    console.log('[handleDateSelect] 위치기록 요약 초기화 완료');
    
    // 4. 날짜 상태 업데이트
    setPreviousDate(selectedDate);
    setSelectedDate(date);
    
    console.log('[LOGS] 완전 초기화 완료 - 새 데이터 로딩 시작');
    
    // 5. 새 데이터 로딩 준비
    if (selectedGroupId) {
      loadMemberActivityByDate(selectedGroupId, date);
    }
    
    // 6. 멤버 마커 재생성 후 위치 데이터 로딩
    console.log('[LOGS] 멤버 마커 재생성 후 위치 데이터 로딩 준비');
    
    // 약간의 지연 후 멤버 마커 재생성 및 데이터 로딩
    // setTimeout(() => {
      // 먼저 멤버 마커 재생성
      // if (groupMembers.length > 0) {
      //   console.log('[LOGS] 날짜 변경 후 멤버 마커 재생성');
      //   updateMemberMarkers(groupMembers, true); // 날짜 변경임을 명시
      // }
      
      // 선택된 멤버가 있으면 위치 데이터 로딩 (정확한 최신 멤버 정보 재확인)
      setTimeout(() => {
        const currentSelectedMember = groupMembers.find(m => m.isSelected);
        if (currentSelectedMember) {
          console.log('[LOGS] 선택된 멤버 새 데이터 로딩:', currentSelectedMember.name, date);
          
          // 플래그 리셋하고 데이터 로딩
          isDateChangingRef.current = false;
          console.log('[handleDateSelect] 자동 재생성 방지 플래그 OFF - 새 데이터 로딩 시작');
          
          // 실제 데이터 로딩 수행
          const memberId = parseInt(currentSelectedMember.id);
          
          // 데이터 로딩 직전에 로딩 상태 활성화
          setIsLocationDataLoading(true);
          
          // loadLocationDataWithMapPreset 호출하여 지도 설정과 함께 데이터 로딩
          loadLocationDataWithMapPreset(memberId, date, currentSelectedMember, false).then(() => {
            console.log('[handleDateSelect] 통합 데이터 로딩 완료');
          }).catch((error) => {
            console.error('[handleDateSelect] 데이터 로딩 오류:', error);
            setIsLocationDataLoading(false);
          });
        } else {
          // 선택된 멤버가 없으면 로딩 해제하고 플래그 리셋
          isDateChangingRef.current = false;
          setIsLocationDataLoading(false);
          console.log('[handleDateSelect] 선택된 멤버 없음 - 플래그 리셋 및 로딩 해제');
        }
      }, 10); // 10ms 지연으로 멤버 변경 상태 반영 대기
    
    // 날짜 선택 시 사이드바 즉시 닫기
    setIsSidebarOpen(false);
    console.log('[handleDateSelect] 날짜 선택으로 사이드바 즉시 닫기');
    
    console.log('[LOGS] ===== 날짜 선택 완료 =====');
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
      const adjustedPosition = new window.naver.maps.LatLng(currentLat, currentLng);
      
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
          const adjustedPosition = new window.naver.maps.LatLng(targetLat, startLng);
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
      const position = new window.naver.maps.LatLng(lat, lng);
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
    
    if (!mtIdx || !date || !map.current) {
      console.log('[loadLocationData] ❌ 필수 조건 미충족 - 실행 중단:', { mtIdx, date, mapReady: !!map.current });
      return;
    }
    
    console.log(`[loadLocationData] ✅ 필수 조건 충족 - 위치 데이터 로딩 시작`);

    // 캐시에서 먼저 확인 (멤버별로 구분하여 확인)
    if (selectedGroupId) {
      const cachedLocationData = getCachedLocationData(selectedGroupId, date, mtIdx.toString());
      const isCacheValid_Location = isCacheValid('locationData', selectedGroupId, date);
      
      if (cachedLocationData && isCacheValid_Location) {
        console.log(`[loadLocationData] 캐시에서 위치 데이터 사용 (멤버 ${mtIdx}):`, date);
        
        // 캐시된 데이터를 상태에 설정
        setDailySummaryData(cachedLocationData.dailySummary || []);
        setStayTimesData(cachedLocationData.stayTimes || []);
        setMapMarkersData(cachedLocationData.mapMarkers || []);
        setLocationLogSummaryData(cachedLocationData.locationLogSummary || null);
        
        // 요약 데이터 계산 및 설정
        const calculatedSummary = calculateLocationStats(cachedLocationData.mapMarkers || []);
        setLocationSummary(calculatedSummary);
        
        // 캐시된 데이터로 지도 렌더링
        console.log('[loadLocationData] 캐시된 데이터로 지도 렌더링 시작:', {
          mapMarkers: cachedLocationData.mapMarkers?.length || 0,
          stayTimes: cachedLocationData.stayTimes?.length || 0,
          mapReady: !!map.current,
          naverMapsReady: !!window.naver?.maps
        });
        
        if (map.current && window.naver?.maps && cachedLocationData.mapMarkers) {
          // 캐시 데이터도 지연 처리하여 상태 업데이트 완료 후 렌더링
          setTimeout(async () => {
            try {
              await renderLocationDataOnMap(
                cachedLocationData.mapMarkers, 
                cachedLocationData.stayTimes || [], 
                cachedLocationData.locationLogSummary, 
                groupMembers, 
                map.current
              );
              console.log('[loadLocationData] 캐시된 데이터 지도 렌더링 완료');
              
              // 렌더링 완료 후 지도 새로고침
              if (map.current) {
                map.current.refresh(true);
                console.log('[loadLocationData] 캐시 데이터 지도 새로고침 완료');
              }
            } catch (renderError) {
              console.error('[loadLocationData] 캐시 데이터 지도 렌더링 오류:', renderError);
            }
          }, 100); // 100ms 지연
        } else {
          console.warn('[loadLocationData] 캐시 데이터 지도 렌더링 건너뜀:', {
            mapReady: !!map.current,
            naverMapsReady: !!window.naver?.maps,
            hasMapMarkers: !!cachedLocationData.mapMarkers
          });
        }
        
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
    
    // 다른 멤버의 요청이 실행 중인 경우 취소하고 새 요청 시작
    if (loadLocationDataExecutingRef.current.executing && loadLocationDataExecutingRef.current.currentRequest !== executionKey) {
      console.log(`[loadLocationData] 🛑 다른 멤버 요청 진행 중 - 이전 요청 취소: ${loadLocationDataExecutingRef.current.currentRequest} → ${executionKey}`);
      loadLocationDataExecutingRef.current.cancelled = true;
      loadLocationDataExecutingRef.current.executing = false;
      loadLocationDataExecutingRef.current.currentRequest = undefined;
      // 잠시 대기하여 이전 요청이 정리되도록 함
      await new Promise(resolve => setTimeout(resolve, 100));
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

      // 타임아웃 설정 (30초)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API 요청 타임아웃 (30초)')), 30000);
      });

      // 모든 API를 병렬로 호출 (타임아웃과 함께)
      const apiPromises = Promise.all([
        memberLocationLogService.getDailyLocationLogs(mtIdx, date).catch(err => {
          console.warn('[loadLocationData] getDailyLocationLogs 실패:', err);
          return []; // 실패 시 빈 배열 반환
        }),
        memberLocationLogService.getDailyLocationSummary(mtIdx, date).catch(err => {
          console.warn('[loadLocationData] getDailyLocationSummary 실패:', err);
          return null; // 실패 시 null 반환
        }),
        memberLocationLogService.getDailySummaryByRange(mtIdx, date, date).catch(err => {
          console.warn('[loadLocationData] getDailySummaryByRange 실패:', err);
          return []; // 실패 시 빈 배열 반환
        }),
        memberLocationLogService.getStayTimes(mtIdx, date).catch(err => {
          console.warn('[loadLocationData] getStayTimes 실패:', err);
          return []; // 실패 시 빈 배열 반환
        }),
        memberLocationLogService.getMapMarkers(mtIdx, date).catch(err => {
          console.warn('[loadLocationData] getMapMarkers 실패:', err);
          return []; // 실패 시 빈 배열 반환
        }),
        memberLocationLogService.getLocationLogSummary(mtIdx, date).catch(err => {
          console.warn('[loadLocationData] getLocationLogSummary 실패:', err);
          return null; // 실패 시 null 반환
        })
      ]);

      const [logs, summary, dailySummary, stayTimes, mapMarkers, locationLogSummary] = await Promise.race([
        apiPromises,
        timeoutPromise
      ]) as any[];

      // API 응답 완료 후 요청이 여전히 유효한지 확인
      if (loadLocationDataExecutingRef.current.cancelled || loadLocationDataExecutingRef.current.currentRequest !== executionKey) {
        console.log(`[loadLocationData] 🚫 요청이 취소되었거나 다른 요청으로 대체됨 - 결과 무시: ${executionKey}`);
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
        setCachedLocationData(selectedGroupId, date, mtIdx.toString(), locationDataForCache);
        console.log(`[loadLocationData] 데이터를 캐시에 저장 (멤버 ${mtIdx}):`, date);
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
         setLocationSummary({...calculatedSummary});
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

      if (map.current && window.naver?.maps) {
        // 지도 렌더링을 약간 지연시켜 상태 업데이트가 완료된 후 실행
        setTimeout(async () => {
          try {
            await renderLocationDataOnMap(
              validatedData.mapMarkers, 
              validatedData.stayTimes, 
              validatedData.locationLogSummary, 
              currentMembers, 
              map.current
            );
            console.log('[loadLocationData] 통합 지도 렌더링 함수 호출 완료');
            
            // 렌더링 완료 후 지도 새로고침
            if (map.current) {
              map.current.refresh(true);
              console.log('[loadLocationData] 지도 새로고침 완료');
            }
          } catch (renderError) {
            console.error('[loadLocationData] 지도 렌더링 오류:', renderError);
            // 렌더링 실패 시에도 멤버 마커는 표시
            const selectedMember = groupMembers.find(m => m.isSelected);
            if (selectedMember && map.current) {
              updateMemberMarkers([selectedMember], false);
            }
          }
        }, 100); // 100ms 지연
      } else {
        console.warn('[loadLocationData] 지도가 준비되지 않아 렌더링 건너뜀:', {
          mapReady: !!map.current,
          naverMapsReady: !!window.naver?.maps
        });
      }

    } catch (error) {
      console.error('[loadLocationData] 위치 데이터 로딩 오류:', error);
      
      // 네트워크 오류나 타임아웃인 경우 자동 재시도 (최대 2회)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('타임아웃') || 
                            errorMessage.includes('Network') || 
                            errorMessage.includes('fetch');
      
      if (isNetworkError && retryCount < 2) {
        console.log(`[loadLocationData] 네트워크 오류 감지 - 자동 재시도 (${retryCount + 1}/2):`, errorMessage);
        setRetryCount(prev => prev + 1);
        
        // 2초 후 재시도
        setTimeout(() => {
          loadLocationData(mtIdx, date);
        }, 2000);
        return;
      }
      
      // 에러 처리
      handleDataError(error, 'loadLocationData');
      
      // 오류 시 기본값으로 설정 및 지도 정리
      setCurrentLocationLogs([]);
      setLocationSummary(DEFAULT_LOCATION_SUMMARY);
      setDailySummaryData([]);
      setStayTimesData([]);
      setMapMarkersData([]);
      setLocationLogSummaryData(null);
      setSortedLocationData([]);

      // 오류 발생 시에도 멤버 아이콘은 표시되도록 지도 정리 후 멤버 마커만 다시 그림
       if(map.current) {
           console.log('[loadLocationData] 오류 발생 - 지도 정리 후 멤버 아이콘만 다시 그림');
           clearMapMarkersAndPaths(true); // 전체 정리
           const selectedMember = groupMembers.find(m => m.isSelected);
            if (selectedMember) {
                try {
                    const lat = selectedMember.mlt_lat !== null && selectedMember.mlt_lat !== undefined && selectedMember.mlt_lat !== 0 ? parseFloat(selectedMember.mlt_lat.toString()) : parseFloat(selectedMember.location.lat.toString() || '37.5665');
                    const lng = selectedMember.mlt_long !== null && selectedMember.mlt_long !== undefined && selectedMember.mlt_long !== 0 ? parseFloat(selectedMember.mlt_long.toString()) : parseFloat(selectedMember.location.lng.toString() || '126.9780');
                     const position = new window.naver.maps.LatLng(lat, lng);
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
      // 항상 상태 정리 (취소 로직 제거)
      setIsLocationDataLoading(false); // 로딩 상태 종료
      loadLocationDataExecutingRef.current.executing = false;
      loadLocationDataExecutingRef.current.currentRequest = undefined;
      loadLocationDataExecutingRef.current.cancelled = false; // 항상 false로 리셋
      
      console.log(`[loadLocationData] 🔄 로딩 상태 정리 완료: ${executionKey}`);
      
      // 성공적으로 완료된 경우 마지막 로딩된 멤버 정보 업데이트
      if (!loadLocationDataExecutingRef.current.cancelled && loadLocationDataExecutingRef.current.currentRequest === executionKey) {
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
    if (!locationData || locationData.length === 0) {
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
              console.log('[calculateLocationStats] 1시간 이상 구간 제외:', {
                prevTime: new Date(prev.timestamp || prev.mlt_gps_time || '').toISOString(),
                currTime: new Date(curr.timestamp || curr.mlt_gps_time || '').toISOString(),
                segmentTimeHours: segmentTimeHours.toFixed(2) + '시간',
                distance: distance.toFixed(2) + 'm',
                reason: '시간 간격이 1시간 이상'
              });
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

    // 걸음수는 마지막 마커의 mt_health_work 데이터 사용
    let actualSteps = 0;
    
    if (sortedData.length > 0) {
      const latestData = sortedData[sortedData.length - 1];
      const latestHealthWork = latestData.mt_health_work || latestData.health_work || 0;
      
      if (latestHealthWork > 0) {
        actualSteps = latestHealthWork;
        console.log('[calculateLocationStats] 마지막 마커의 걸음수 데이터 사용:', {
          latestDataTime: latestData.timestamp || latestData.mlt_gps_time,
          latestHealthWork: latestHealthWork
        });
      } else {
        console.log('[calculateLocationStats] 마지막 마커에 mt_health_work 데이터가 없어서 0으로 설정');
      }
    }

    // 포맷팅
    const distanceKm = (totalDistance / 1000).toFixed(1);
    const timeFormatted = formatTime(movingTimeSeconds);
    const stepsFormatted = actualSteps.toLocaleString();

    console.log('[calculateLocationStats] 계산 결과:', {
      totalDistance: totalDistance,
      distanceKm: distanceKm,
      movingTimeSeconds: movingTimeSeconds,
      timeFormatted: timeFormatted,
      actualSteps: actualSteps,
      dataPoints: sortedData.length,
      note: '마커 데이터 기반 이동거리/시간 계산, 마지막 마커의 mt_health_work 걸음수 사용'
    });

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

  const updateSliderValue = (e: React.TouchEvent | React.MouseEvent | MouseEvent | TouchEvent) => {
    if (!sliderRef.current || !isSliderDragging) return;

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
      
      const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      
      // 유효하지 않은 percentage 값 체크
      if (isNaN(percentage) || !isFinite(percentage)) return;
      
      // 성능 최적화: 값이 크게 변하지 않으면 업데이트 건너뛰기
      const currentValue = sliderValue;
      if (Math.abs(percentage - currentValue) < 0.2) return; // 더 민감하게 반응
      
      // 상태 업데이트 (React의 배치 처리에 맡김)
      setSliderValue(percentage);
      
      // 경로 진행률 업데이트 (즉시 실행)
      updatePathProgress(percentage);
    } catch (error) {
      console.error('[updateSliderValue] 에러 발생:', error);
    }
  };

  // 현재 위치 마커 생성/업데이트 함수
  const createOrUpdateCurrentPositionMarker = (lat: number, lng: number, targetIndex: number, totalMarkers: number) => {
    if (!map.current || !window.naver?.maps) return;

    const position = new window.naver.maps.LatLng(lat, lng);

    // 기존 현재 위치 마커 제거
    if (currentPositionMarker.current) {
      // InfoWindow가 있다면 먼저 닫기
      if (currentPositionMarker.current.infoWindow) {
        currentPositionMarker.current.infoWindow.close();
      }
      currentPositionMarker.current.setMap(null);
    }

    // 현재 마커 데이터 가져오기
    const currentMarkerData = sortedLocationData[targetIndex];
    if (!currentMarkerData) return;

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

    // InfoWindow 내용 생성 (모바일 Safari 호환성 강화)
    const infoContent = `
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

    // 새로운 현재 위치 마커 생성
    currentPositionMarker.current = new window.naver.maps.Marker({
      position: position,
      map: map.current,
      title: `현재 위치 (${targetIndex + 1}/${totalMarkers})`,
      icon: {
        content: `
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
          ">
            <div style="
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
            "></div>
          </div>
          <style>
            @keyframes pulse {
              0% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(239,68,68,0.2); }
              50% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 8px rgba(239,68,68,0.1); }
              100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(239,68,68,0.2); }
            }
          </style>
        `,
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

    // console.log(`[현재위치마커] 위치 업데이트: (${lat}, ${lng}) - ${targetIndex + 1}/${totalMarkers}`);
  };

  // 슬라이더 값에 따라 경로 진행 상황 업데이트
  const updatePathProgress = (percentage: number) => {
    if (!map.current || sortedLocationData.length === 0) return;

    const totalMarkers = sortedLocationData.length;
    const currentIndex = Math.floor((percentage / 100) * totalMarkers);
    const targetIndex = Math.min(currentIndex, totalMarkers - 1);

    if (targetIndex >= 0 && sortedLocationData[targetIndex]) {
      const targetMarker = sortedLocationData[targetIndex];
      const lat = targetMarker.latitude || targetMarker.mlt_lat || 0;
      const lng = targetMarker.longitude || targetMarker.mlt_long || 0;

      if (lat && lng) {
        const center = new window.naver.maps.LatLng(Number(lat), Number(lng));
        
        // console.log(`[경로따라가기] 지도 중심 이동 시도: ${percentage.toFixed(1)}% - ${targetIndex + 1}/${totalMarkers}`, {
        //   lat: Number(lat),
        //   lng: Number(lng),
        //   center: { lat: Number(lat), lng: Number(lng) }
        // });
        
        // 1. 마커를 먼저 생성/업데이트 (즉시 반응)
        createOrUpdateCurrentPositionMarker(Number(lat), Number(lng), targetIndex, totalMarkers);
        
        // 2. 지도 중심을 부드럽게 이동
        map.current.setCenter(center);
        // console.log('[경로따라가기] 지도 중심 이동 완료:', { lat: Number(lat), lng: Number(lng) });
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
      
      // 캐시에 저장
      setCachedDailyLocationCounts(groupId, response);
      
      console.log('[LOGS] 일별 위치 기록 카운트 조회 완료:', response);
    } catch (error) {
      console.error('[LOGS] 일별 위치 기록 카운트 조회 실패:', error);
      handleDataError(error, 'loadDailyLocationCounts');
      setDailyCountsData(null);
    } finally {
      setIsDailyCountsLoading(false);
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

  // 로딩 상태 안전장치 - 30초 후 강제 종료
  useEffect(() => {
    if (isLocationDataLoading) {
      const timeoutId = setTimeout(() => {
        console.warn('[안전장치] 로딩이 30초 이상 지속되어 강제 종료');
        setIsLocationDataLoading(false);
        loadLocationDataExecutingRef.current.executing = false;
        loadLocationDataExecutingRef.current.currentRequest = undefined;
        loadLocationDataExecutingRef.current.cancelled = false;
        
        // 타임아웃 에러 표시
        setDataError({
          type: 'network',
          message: '데이터 로딩 시간이 초과되었습니다. 다시 시도해주세요.',
          retryable: true
        });
      }, 30000);

      return () => clearTimeout(timeoutId);
    }
  }, [isLocationDataLoading]);

  // 새로운 API 데이터가 변경될 때마다 콘솔에 출력
  useEffect(() => {
    if (dailySummaryData.length > 0 || stayTimesData.length > 0 || mapMarkersData.length > 0 || locationLogSummaryData || dailyCountsData || memberActivityData) {
      logNewApiData();
    }
  }, [dailySummaryData, stayTimesData, mapMarkersData, locationLogSummaryData, dailyCountsData, memberActivityData]);

  // 날짜 변경 중 자동 재생성 방지 플래그
  const isDateChangingRef = useRef(false);

  // 지도 마커 데이터가 변경될 때마다 지도에 마커 업데이트 (날짜 변경 중에는 방지)
  useEffect(() => {
    console.log('[LOGS] 마커 데이터 변경 감지:', {
      isMapInitializedLogs,
      mapMarkersDataLength: mapMarkersData.length,
      mapMarkersData: mapMarkersData.slice(0, 2), // 첫 2개만 로그
      isDateChanging: isDateChangingRef.current
    });
    
         // 날짜 변경 중이면 자동 재생성 완전 방지
     if (isDateChangingRef.current) {
       console.log('[LOGS] 날짜 변경 중 - 자동 마커 업데이트 완전 차단!');
       return;
     }
    
    if (isMapInitializedLogs) {
      console.log('[LOGS] 지도에 마커 업데이트 실행:', mapMarkersData.length, '개');
      // updateLocationLogMarkers(mapMarkersData); // loadLocationData에서 호출하므로 주석 처리
      
      // 첫 번째 마커(시작지점)를 기준으로 지도 중심 조정
      if (map.current && mapMarkersData.length > 0) {
        const firstMarker = mapMarkersData[0];
        const lat = firstMarker.latitude || firstMarker.mlt_lat || 0;
        const lng = firstMarker.longitude || firstMarker.mlt_long || 0;
        
        if (lat !== 0 && lng !== 0) {
          const adjustedPosition = new window.naver.maps.LatLng(lat, lng);
          
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
          if(selectedMember) {
              const memberLat = selectedMember.mlt_lat || selectedMember.location.lat || 37.5665;
              const memberLng = selectedMember.mlt_long || selectedMember.location.lng || 126.9780;
              const adjustedPosition = new window.naver.maps.LatLng(memberLat, memberLng);
              
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
  }, [mapMarkersData, isMapInitializedLogs, groupMembers]); // groupMembers 종속성 추가

  // 체류시간 데이터가 변경될 때마다 지도에 체류시간 마커 업데이트
  // (updateLocationLogMarkers 내에서 호출되므로 중복 실행 방지를 위해 주석 처리)
  // useEffect(() => {
  //   if (isMapInitializedLogs && stayTimesData.length > 0) {
  //     console.log('[LOGS] 체류시간 데이터 변경 감지 - 지도에 체류시간 마커 업데이트:', stayTimesData.length, '개');
  //     updateStayTimeMarkers(stayTimesData);
  //   }
  // }, [stayTimesData, isMapInitializedLogs]);

  // 그룹 멤버가 변경될 때마다 멤버 마커 업데이트
  useEffect(() => {
    if (isMapInitializedLogs && groupMembers.length > 0) {
      console.log('[LOGS] 그룹 멤버 변경 감지 - 멤버 마커 업데이트:', groupMembers.length, '명');
      // 날짜 변경 중이 아닐 때만 업데이트 (날짜 변경 중에는 자동 재생성 방지)
      if (!isDateChangingRef.current) {
        // 로그 데이터가 없고 선택된 멤버가 있으면 지도 중심 먼저 설정
        const selectedMember = groupMembers.find(m => m.isSelected);
        if (selectedMember && sortedLocationData.length === 0 && map.current) {
          const memberLat = selectedMember.mlt_lat || selectedMember.location.lat || 37.5665;
          const memberLng = selectedMember.mlt_long || selectedMember.location.lng || 126.9780;
          const adjustedPosition = new window.naver.maps.LatLng(memberLat, memberLng);
          
          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16);
          
          setTimeout(() => {
            updateMemberMarkers(groupMembers, false);
          }, 50);
        } else {
          updateMemberMarkers(groupMembers, false);
        }
      } else {
        console.log('[LOGS] 날짜 변경 중으로 멤버 마커 업데이트 건너뜀');
      }
    }
  }, [groupMembers, isMapInitializedLogs, sortedLocationData]);

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
    console.log("[LogsPage] 🔥 useEffect 실행됨:", {
      isMapInitializedLogs,
      groupMembersLength: groupMembers.length,
      hasSelectedMember: groupMembers.some(m => m.isSelected),
      mapExists: !!map.current,
      naverMapsExists: !!window.naver?.maps
    });
    
    if (isMapInitializedLogs && groupMembers.length > 0) {
      // 첫 번째 멤버 자동 선택 (선택된 멤버가 없는 경우)
      if (!groupMembers.some(m => m.isSelected)) {
        console.log("[LogsPage] 🎯 Auto-selection: Setting first member as selected.");
        
        // 자동 선택 전에 모든 플래그 리셋 (확실히 하기 위해)
        isDateChangingRef.current = false;
        isDateChangedRef.current = false;
        console.log("[LogsPage] Auto-selection: 모든 플래그 리셋 완료");
        
        // 멤버 상태 업데이트 후 마커 생성
        const updatedMembers = groupMembers.map((member, index) => ({
          ...member,
          isSelected: index === 0
        }));
        
        // 지도 중심을 먼저 설정한 후 마커 생성 (부자연스러운 이동 방지)
        const firstMember = updatedMembers[0];
                  if (map.current && firstMember) {
            const adjustedPosition = new window.naver.maps.LatLng(
              firstMember.location.lat, 
              firstMember.location.lng
            );
          map.current.setCenter(adjustedPosition);
          map.current.setZoom(16);
          console.log("[LogsPage] Auto-selection: 지도 중심 먼저 설정 완료");
        }
        
        setGroupMembers(updatedMembers);
        
        // 지연 후 멤버 마커 생성 (지도 중심 설정 후)
        setTimeout(() => {
          console.log("[LogsPage] Auto-selection: 지연 후 멤버 마커 생성");
          updateMemberMarkers(updatedMembers, false);
        }, 50);
        
        // 자동 선택 시에는 데이터 로딩하지 않음 (사용자가 직접 선택할 때까지 대기)
        const firstMemberId = groupMembers[0].id;
        console.log("[LogsPage] Auto-selection: 첫 번째 멤버 선택 완료 - 데이터 로딩은 사용자 액션 대기:", firstMemberId);
        
        // 자동 선택 플래그 설정 (사용자 액션이 아님을 표시)
        setFirstMemberSelected(true);
        
        return; // 상태 업데이트 후 다음 렌더 사이클에서 처리되도록 return
      }

      // 선택된 멤버가 있는 경우 지도 업데이트
      console.log("[LogsPage] Member selection detected or map initialized with selection. Updating markers and view.");
      
      // 날짜 변경 플래그 확인
      const isDateChange = isDateChangedRef.current;
      console.log('[LOGS] useEffect - 날짜 변경 체크:', { 
        previousDate, 
        selectedDate, 
        isDateChange,
        firstMemberSelected,
        isDateChangedRefValue: isDateChangedRef.current
      });
      // updateMemberMarkers(groupMembers, isDateChange); // loadLocationData에서 처리하도록 주석 처리
      // setActiveLogView('members'); // 이제 summary만 사용하므로 제거
      
      // 자동 재생성 방지 플래그가 설정되어 있으면 리셋
      if (isDateChangingRef.current) {
        console.log('[LOGS] useEffect - 자동 재생성 방지 플래그 강제 리셋');
        isDateChangingRef.current = false;
      }
    }
  }, [groupMembers, isMapInitializedLogs]); // selectedDate 제거 - 날짜 변경 시 지도 조정 중복 방지



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
      setSelectedGroupId(userGroups[0].sgt_idx);
      console.log(`[${instanceId.current}] UserContext에서 첫 번째 그룹 자동 선택:`, userGroups[0].sgt_title);
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

      // 중복 실행 방지
      if (dataFetchedRef.current.members || fetchDataExecutingRef.current || hasExecuted.current) {
        console.log(`[${instanceId.current}] 중복 실행 방지 - 이미 로드됨 또는 실행 중`);
        return;
      }

      hasExecuted.current = true;
      fetchDataExecutingRef.current = true;
      const fetchId = Math.random().toString(36).substr(2, 9);
      console.log(`[${instanceId.current}-fetchAllGroupData-${fetchId}] 데이터 페칭 시작:`, selectedGroupId);

      try {
        const groupIdToUse = selectedGroupId.toString();
        console.log('[fetchAllGroupData] 사용할 그룹 ID:', groupIdToUse);

        let currentMembers: GroupMember[] = groupMembers.length > 0 ? [...groupMembers] : [];

        if (!dataFetchedRef.current.members) {
          // 캐시에서 먼저 확인
          const cachedMembers = getCachedGroupMembers(selectedGroupId);
          const isCacheValid_Members = isCacheValid('groupMembers', selectedGroupId);
          
          if (cachedMembers && cachedMembers.length > 0 && isCacheValid_Members) {
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
                photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
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
              const memberData = await memberService.getGroupMembers(groupIdToUse);
            
              if (isMounted && memberData && memberData.length > 0) { 
                // 캐시에 저장 (타입 변환)
                const cacheMembers = memberData.map((member: any) => ({
                  ...member,
                  sgdt_owner_chk: member.sgdt_owner_chk || '',
                  sgdt_leader_chk: member.sgdt_leader_chk || ''
                }));
                setCachedGroupMembers(selectedGroupId, cacheMembers);
                
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
                    photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
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

                // 첫 번째 멤버의 데이터 기반 통합 지도 설정 - 자동 날짜 선택 후 처리됨
                if (currentMembers.length > 0 && map.current) {
                  const firstMember = currentMembers[0];
                  console.log('[LOGS] 첫 번째 멤버로 통합 지도 설정 시작:', firstMember.name);
                  // 자동 날짜 선택 로직이 데이터가 있는 날짜를 찾아서 위치 데이터를 로딩할 예정
                }
              } else {
                console.warn('❌ No member data from API, or API call failed.');
                setGroupMembers([]);
                handleDataError(new Error('그룹 멤버 데이터가 없습니다.'), 'fetchAllGroupData');
              }
            } catch (memberError) {
              console.error('[LOGS] 그룹 멤버 조회 API 오류:', memberError);
              handleDataError(memberError, 'fetchAllGroupData');
              setGroupMembers([]);
            } 
            dataFetchedRef.current.members = true;

            // 그룹 멤버 조회 완료 후 날짜별 활동 로그 관련 API 호출 (병렬 처리)
            console.log('[LOGS] 그룹 멤버 조회 완료 - 날짜별 활동 로그 API 호출 시작');
            
            // 1, 2번을 병렬로 실행하여 성능 최적화
            if (isMounted) {
              const promises = [];
              
              // 1. 최근 14일간 일별 카운트 조회 (캐시 우선, 한 번만 실행)
              if (!dailyCountsData || !dataFetchedRef.current.dailyCounts) {
                const cachedCounts = getCachedDailyLocationCounts(selectedGroupId);
                const isCountsCacheValid = isCacheValid('dailyLocationCounts', selectedGroupId);
                
                if (cachedCounts && isCountsCacheValid) {
                  console.log('[LOGS] 캐시에서 일별 카운트 데이터 사용');
                  setDailyCountsData(cachedCounts);
                  dataFetchedRef.current.dailyCounts = true;
                } else {
                  console.log('[LOGS] 캐시 미스 - API에서 일별 카운트 데이터 조회 (한 번만)');
                  promises.push(loadDailyLocationCounts(selectedGroupId, 14));
                  dataFetchedRef.current.dailyCounts = true;
                }
              } else {
                console.log('[LOGS] 일별 카운트 데이터 이미 로드됨 - 건너뛰기');
              }
              
              // 2. 현재 선택된 날짜의 멤버 활동 조회
              if (selectedDate) {
                promises.push(loadMemberActivityByDate(selectedGroupId, selectedDate));
              }
              
              // 병렬 실행
              if (promises.length > 0) {
                try {
                  await Promise.all(promises);
                } catch (promiseError) {
                  console.error('[LOGS] 병렬 API 호출 중 일부 실패:', promiseError);
                  // 일부 실패해도 계속 진행
                }
              }
            }
            
            console.log('[LOGS] 날짜별 활동 로그 API 호출 완료');
            

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
  }, [selectedGroupId]);

  // 그룹 선택 핸들러 - 메인 인스턴스에서만
  const handleGroupSelect = async (groupId: number) => {
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
  };

  // 그룹별 멤버 수 조회 - 메인 인스턴스에서만
  useEffect(() => {
    if (!isMainInstance.current) return;
    
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log(`[${instanceId.current}] 그룹 멤버 수 조회 시작:`, userGroups.length, '개 그룹');
      
      const counts: Record<number, number> = {};
      
      await Promise.all(userGroups.map(async (group) => {
        try {
          const count = await getGroupMemberCount(group.sgt_idx);
          counts[group.sgt_idx] = count;
          console.log(`[${instanceId.current}] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수:`, count);
        } catch (error) {
          console.error(`[${instanceId.current}] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
          counts[group.sgt_idx] = 0;
        }
      }));
      
      setGroupMemberCounts(counts);
      console.log(`[${instanceId.current}] 그룹 멤버 수 조회 완료:`, counts);
    };

    fetchGroupMemberCounts();
  }, [userGroups]);

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
    if (sidebarDateX && dateToScroll) {
      const recentDays = getRecentDays();
      const targetIndex = recentDays.findIndex(day => day.value === dateToScroll);
      
      if (targetIndex !== -1) {
        const itemWidth = 85; // 각 버튼 width (min-w-[75px] + gap)
        const containerWidth = 200; // 컨테이너 width
        const totalWidth = recentDays.length * itemWidth;
        const maxScroll = Math.max(0, totalWidth - containerWidth);
        
        // 선택된 날짜가 중앙에 오도록 스크롤 위치 계산
        const targetScroll = Math.min(maxScroll, Math.max(0, (targetIndex * itemWidth) - (containerWidth / 2) + (itemWidth / 2)));
        
        sidebarDateX.set(-targetScroll);
        lastScrolledIndexRef.current = targetIndex;
        
        console.log(`[사이드바 날짜] 선택된 날짜(${dateToScroll})로 스크롤 완료`, { 
          targetIndex, 
          targetScroll, 
          totalWidth, 
          containerWidth, 
          maxScroll 
        });
      } else {
        // 선택된 날짜가 범위에 없으면 오늘 날짜로 폴백
        scrollSidebarDateToToday();
        console.log(`[사이드바 날짜] 선택된 날짜(${dateToScroll})가 범위에 없어 오늘 날짜로 폴백`);
      }
    }
  };

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    
    // 사이드바가 열릴 때 선택된 멤버로 스크롤하고 선택된 날짜로 스크롤 조정
    if (!isSidebarOpen) {
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
  };

  // 사이드바 외부 클릭 처리
  useEffect(() => {
    const handleSidebarClickOutside = (event: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleSidebarClickOutside);
    } else {
      document.removeEventListener('mousedown', handleSidebarClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleSidebarClickOutside);
    };
  }, [isSidebarOpen]);

  // 사이드바가 열릴 때 날짜 스크롤 초기화
  useEffect(() => {
    if (isSidebarOpen) {
      setTimeout(() => {
        scrollSidebarDateToToday();
      }, 150);
    }
  }, [isSidebarOpen]);

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

  // dailyCountsData가 로드된 후 초기 진입 시에만 최근 활동 날짜로 자동 선택
  useEffect(() => {
    if (dailyCountsData && groupMembers.length > 0 && isInitialEntry) {
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        console.log(`[LOGS] 초기 진입 - dailyCountsData 로드 완료: ${selectedMember.name}`);
        
        // 초기 진입 시에만 최근 활동 날짜로 자동 변경
        const memberMtIdx = parseInt(selectedMember.id);
        const memberData = dailyCountsData.member_daily_counts.find(
          member => member.member_id === memberMtIdx
        );
        
        if (memberData) {
          // 최근 15일 동안 활동이 있는 가장 최근 날짜 찾기
          const recentDays = Array.from({ length: 15 }, (_, i) => {
            const date = subDays(new Date(), 14 - i);
            return format(date, 'yyyy-MM-dd');
          });
          
          let foundRecentDate = null;
          for (let i = recentDays.length - 1; i >= 0; i--) {
            const dateString = recentDays[i];
            const shortDateString = format(new Date(dateString), 'MM.dd');
            const dayData = memberData.daily_counts.find(
              day => day.formatted_date === shortDateString
            );
            
            if (dayData && dayData.count > 0) {
              foundRecentDate = dateString;
              console.log(`[LOGS] 초기 진입 - 최근 활동 날짜 발견: ${dateString} (${dayData.count}건)`);
              break;
            }
          }
          
          if (foundRecentDate && foundRecentDate !== selectedDate) {
            console.log(`[LOGS] 초기 진입 - 날짜 자동 변경: ${selectedDate} → ${foundRecentDate}`);
            setSelectedDate(foundRecentDate);
          } else {
            console.log(`[LOGS] 초기 진입 - 현재 날짜(${selectedDate}) 유지`);
          }
        }
        
        // 초기 진입 플래그 해제
        setIsInitialEntry(false);
      }
    } else if (dailyCountsData && groupMembers.length > 0 && !isInitialEntry) {
      // 초기 진입 이후에는 자동 날짜 변경 없이 현재 날짜 데이터만 확인
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember) {
        console.log(`[LOGS] 일반 사용 - 현재 날짜(${selectedDate}) 데이터 확인`);
        
        const memberMtIdx = parseInt(selectedMember.id);
        const memberData = dailyCountsData.member_daily_counts.find(
          member => member.member_id === memberMtIdx
        );
        
        if (memberData) {
          const shortDateString = format(new Date(selectedDate), 'MM.dd');
          const dayData = memberData.daily_counts.find(
            day => day.formatted_date === shortDateString
          );
          
          if (dayData && dayData.count > 0) {
            console.log(`[LOGS] ✅ 현재 선택된 날짜(${selectedDate})에 데이터 있음: ${dayData.count}건`);
          } else {
            console.log(`[LOGS] ⚠️ 현재 선택된 날짜(${selectedDate})에 데이터 없음`);
          }
        }
      }
    }
  }, [dailyCountsData, groupMembers, isInitialEntry, selectedDate]);

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
        document.removeEventListener(event, () => {});
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

  // --- 새로운 통합 지도 렌더링 함수 ---
  const renderLocationDataOnMap = async (locationMarkersData: MapMarker[], stayTimesData: StayTime[], locationLogSummaryData: LocationLogSummary | null, groupMembers: GroupMember[], mapInstance: any) => {
    if (!mapInstance || !window.naver?.maps) {
      console.log('[renderLocationDataOnMap] 지도가 준비되지 않음:', {
        mapInstance: !!mapInstance,
        naverMaps: !!window.naver?.maps
      });
      return;
    }

    console.log('[renderLocationDataOnMap] 통합 지도 렌더링 시작');
    console.log('[renderLocationDataOnMap] 입력 데이터 확인:', {
      locationMarkersData: locationMarkersData?.length || 0,
      stayTimesData: stayTimesData?.length || 0,
      locationLogSummaryData: !!locationLogSummaryData,
      groupMembers: groupMembers?.length || 0
    });

    // 1. 지도 완전히 정리 (멤버 마커 포함)
    clearMapMarkersAndPaths(true);

    // 2. 지도 중심 위치를 시작위치로 설정 (마커 생성 전에)
    console.log('[renderLocationDataOnMap] 지도 중심 위치 계산 시작');
    let mapCenter = null;
    
    // 위치 데이터가 있으면 시작위치로 지도 중심 설정
    if (locationMarkersData.length > 0) {
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
    } else {
      console.log('[renderLocationDataOnMap] 위치 데이터 없음 - 지도 중심 유지');
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
            const marker = new window.naver.maps.Marker({ position: position, map: mapInstance, icon: { content: `<div style="position: relative; width: ${markerStyle.size}px; height: ${markerStyle.size}px; background: ${markerStyle.bgColor}; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${markerStyle.size > 32 ? '14px' : '12px'}; color: ${markerStyle.textColor};">${markerNumber}<div style="position: absolute; top: -20px; right: -20px; background: #1f2937; color: white; border-radius: 8px; padding: 2px 4px; font-size: 10px; font-weight: normal; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${formatDuration(durationMinutes)}</div></div>`, anchor: new window.naver.maps.Point(markerStyle.size/2, markerStyle.size/2) }, zIndex: 200 + index });
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
        
        // 각 구간마다 다른 색상의 폴리라인 생성
        for (let i = 0; i < pathCoordinates.length - 1; i++) {
            const progress = i / (pathCoordinates.length - 1);
            const colorIndex = Math.floor(progress * (rainbowColors.length - 1));
            const nextColorIndex = Math.min(colorIndex + 1, rainbowColors.length - 1);
            const segmentProgress = (progress * (rainbowColors.length - 1)) - colorIndex;
            
            // 두 색상 간 보간
            const color1 = rainbowColors[colorIndex];
            const color2 = rainbowColors[nextColorIndex];
            const interpolatedColor = interpolateColor(color1, color2, segmentProgress);
            
            const segmentPath = [pathCoordinates[i], pathCoordinates[i + 1]];
            const segmentPolyline = new window.naver.maps.Polyline({
                map: mapInstance,
                path: segmentPath,
                strokeColor: interpolatedColor,
                strokeOpacity: 0.85,
                strokeWeight: 5,
                strokeStyle: 'solid'
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
        if (mapInstance && mapCenter) {
          mapInstance.setCenter(mapCenter);
          mapInstance.setZoom(16);
          console.log('[renderLocationDataOnMap] 시작위치로 지도 중심 재설정 완료');
        }
      }, 100);
    }

    // 9. 지도 새로고침 (지연 후 실행)
    setTimeout(() => {
      if (mapInstance) { 
        mapInstance.refresh(true); 
        console.log('[renderLocationDataOnMap] 최종 지도 새로고침 완료');
      }
    }, 500);

    console.log('[renderLocationDataOnMap] 통합 지도 렌더링 완료');
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>
      
      {/* 메인 컨테이너 */}
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #f0f9ff, #ffffff, #fdf4ff)' }}
      >
        {/* 통합 헤더 - 내용만 변경됨 */}
        <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1 
            }}
            className="fixed top-0 left-0 right-0 z-20 backdrop-blur-sm border-b h-16" style={{ background: 'linear-gradient(to right, rgba(240, 249, 255, 0.9), rgba(255, 255, 255, 0.95), rgba(253, 244, 255, 0.9))', borderColor: 'rgba(1, 19, 163, 0.1)' }}
          >
            {/* 헤더 내용 */}
            {showHeader && (
              <motion.div 
                initial={{ opacity: 1 }}
                animate={{ opacity: showHeader ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between h-16 px-4"
              >
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="p-2 rounded-xl" style={{ backgroundColor: '#0113A3' }}
                  >
                    <svg 
                    className="w-5 h-5 text-white" 
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                    <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                  </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">활동 로그</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들의 활동 기록을 확인해보세요</p>
                  </div>
                </div>
              </div>
              </motion.div>
            )}

                        {/* 날짜 선택 내용 */}

          </motion.header>

        {/* 지도 영역 */}
        <div 
          className="full-map-container" 
          style={{ 
            paddingTop: '0px', // 지도 영역을 화면 전체로 확장
            position: 'relative' // 로딩 오버레이를 위한 relative 포지션
          }}
        >
          <div ref={mapContainer} className="w-full h-full" />
          
          {/* 플로팅 통합 정보 카드 - jin의 기록 + 위치기록 요약 한 줄 */}
          <AnimatePresence>
            {groupMembers.some(m => m.isSelected) && selectedDate && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 25,
                  duration: 0.6 
                }}
                className="absolute top-20 left-0 right-0 z-20 flex justify-center px-4"
              >
                <motion.div
                   whileHover={{ 
                     scale: 1.02, 
                     y: -2,
                     boxShadow: "0 12px 35px rgba(1, 19, 163, 0.25)"
                   }}
                   whileTap={{ scale: 0.98 }}
                   onClick={() => setIsSidebarOpen(true)}
                   className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-white/30 cursor-pointer max-w-full"
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                     boxShadow: '0 8px 25px rgba(1, 19, 163, 0.15), 0 0 0 1px rgba(1, 19, 163, 0.05)',
                   }}
                 >
                  <div className="flex items-center justify-between space-x-4">
                    {/* 왼쪽: 멤버 정보 */}
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {/* 선택된 멤버 아바타 */}
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                          <img 
                             src={(() => {
                               const member = groupMembers.find(m => m.isSelected);
                               return member ? getSafeImageUrl(member.photo || null, member.mt_gender, member.original_index) : '';
                             })()}
                             alt={groupMembers.find(m => m.isSelected)?.name || ''} 
                             className="w-full h-full object-cover"
                             onError={(e) => {
                               const target = e.target as HTMLImageElement;
                               const member = groupMembers.find(m => m.isSelected);
                               if (member) {
                                 const defaultImg = getDefaultImage(member.mt_gender, member.original_index);
                                 target.src = defaultImg;
                               }
                             }}
                           />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      
                      {/* 멤버 이름과 날짜 정보 */}
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {groupMembers.find(m => m.isSelected)?.name}
                          </span>
                          <span className="text-xs text-gray-500">의 기록</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs font-medium" style={{ color: '#0113A3' }}>
                            📅 {format(new Date(selectedDate), 'MM월 dd일 (E)', { locale: ko })}
                          </span>
                        </div>
                      </div>
                      
                      {/* 로딩 상태 표시 */}
                      {isLocationDataLoading && (
                        <div className="ml-1">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <FiLoader className="w-4 h-4 text-blue-500" />
                          </motion.div>
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 위치기록 요약 (로딩 중이 아닐 때만 표시) */}
                    {!isLocationDataLoading && (
                      <div className="flex items-center space-x-3 text-xs flex-shrink-0">
                        {/* 거리 */}
                        <div className="flex flex-col items-center space-y-1">
                          <FiTrendingUp className="w-3 h-3 text-amber-500" />
                          <span className="font-medium text-gray-700 whitespace-nowrap">{locationSummary.distance}</span>
                        </div>
                        {/* 시간 */}
                        <div className="flex flex-col items-center space-y-1">
                          <FiClock className="w-3 h-3 text-blue-500" />
                          <span className="font-medium text-gray-700 whitespace-nowrap">{locationSummary.time}</span>
                        </div>
                        {/* 걸음수 */}
                        <div className="flex flex-col items-center space-y-1">
                          <FiZap className="w-3 h-3 text-green-500" />
                          <span className="font-medium text-gray-700 whitespace-nowrap">{locationSummary.steps}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 플로팅 경로따라가기 컨트롤 - 왼쪽 중단 (네비게이션 바 위) */}
          <AnimatePresence>
            {groupMembers.some(m => m.isSelected) && selectedDate && sortedLocationData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 25,
                  duration: 0.6,
                  delay: 0.4
                }}
                className="absolute bottom-20 left-4 z-20"
              >
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-white/95 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-white/30 min-w-[220px]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div className="flex items-center mb-2">
                    <FiPlayCircle className="w-4 h-4 text-blue-500 mr-2" />
                    <h3 className="text-sm font-bold text-gray-900">경로 따라가기</h3>
                  </div>
                  
                  <div className="px-1">
                    <div 
                      ref={sliderRef}
                      className="relative w-full h-3 bg-gray-200 rounded-full cursor-pointer select-none touch-none"
                      style={{ 
                        touchAction: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none'
                      }}
                      onMouseDown={handleSliderStart}
                      onTouchStart={handleSliderStart}
                    >
                      <div 
                        className={`absolute top-0 left-0 h-3 bg-blue-500 rounded-full pointer-events-none ${
                          isSliderDragging ? '' : 'transition-all duration-150 ease-out'
                        }`}
                        style={{ width: `${sliderValue}%` }} 
                      ></div>
                      <div 
                        className={`absolute top-1/2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg transform -translate-y-1/2 cursor-grab active:cursor-grabbing pointer-events-none ${
                          isSliderDragging ? 'scale-110' : 'transition-all duration-150 ease-out hover:scale-105'
                        }`}
                        style={{ left: `calc(${sliderValue}% - 12px)` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>시작</span>
                      <span>{Math.round(sliderValue)}%</span>
                      <span>종료</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>


      </motion.div>

      {/* 플로팅 사이드바 토글 버튼 */}
      <motion.button
        initial={{ y: 100, opacity: 0, scale: 0.8 }}
        animate={{ 
          y: 0, 
          opacity: 1, 
          scale: 1,
          transition: {
            delay: 1.5,
            type: "spring",
            stiffness: 120,
            damping: 25,
            duration: 1.2
          }
        }}
        whileHover={{ 
          scale: 1.1,
          y: -2,
          transition: { duration: 0.2 }
        }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleSidebar}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{
          background: '#0113A3',
          boxShadow: '0 8px 25px rgba(1, 19, 163, 0.3)'
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

      {/* 사이드바 오버레이 */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            variants={sidebarOverlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
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
            className="fixed left-0 top-0 w-80 shadow-2xl border-r z-50 flex flex-col"
            style={{ 
              background: 'linear-gradient(to bottom right, #f0f9ff, #fdf4ff)',
              borderColor: 'rgba(1, 19, 163, 0.1)',
              bottom: '60px',
              height: 'calc(100vh - 60px)'
            }}
          >
            <motion.div
              variants={sidebarContentVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="p-6 h-full flex flex-col relative z-10"
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
                
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGroupSelectorOpen(!isGroupSelectorOpen);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur-sm border rounded-xl text-sm font-medium hover:bg-white/90 hover:shadow-md transition-all duration-200"
                    style={{ 
                      borderColor: 'rgba(1, 19, 163, 0.2)',
                      '--hover-border-color': 'rgba(1, 19, 163, 0.4)'
                    } as React.CSSProperties}
                    disabled={isUserDataLoading}
                  >
                    <span className="truncate text-gray-700">
                      {isUserDataLoading 
                        ? '로딩 중...' 
                        : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                      }
                    </span>
                    <div className="ml-2 flex-shrink-0">
                      {isUserDataLoading ? (
                        <FiLoader className="animate-spin text-gray-400" size={14} />
                      ) : (
                        <motion.div
                          animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <FiChevronDown className="text-gray-400" size={14} />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {isGroupSelectorOpen && userGroups.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-32 overflow-y-auto"
                      >
                        {userGroups.map((group) => (
                          <motion.button
                            key={group.sgt_idx}
                            whileHover={{ backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                            onClick={() => {
                              if (selectedGroupId !== group.sgt_idx) {
                                handleGroupSelect(group.sgt_idx);
                              }
                              setIsGroupSelectorOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs focus:outline-none transition-colors ${
                              selectedGroupId === group.sgt_idx 
                                ? 'font-semibold' 
                                : 'text-gray-900 hover:bg-blue-50'
                            }`}
                            style={selectedGroupId === group.sgt_idx 
                              ? { backgroundColor: 'rgba(1, 19, 163, 0.1)', color: '#0113A3' }
                              : {}
                            }
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{group.sgt_title}</span>
                              {selectedGroupId === group.sgt_idx && (
                                <span className="ml-2" style={{ color: '#0113A3' }}>✓</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {groupMemberCounts[group.sgt_idx] || 0}명의 멤버
                            </div>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

                {/* 날짜 선택 섹션 */}
                <div className="mb-5">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-base font-semibold text-gray-800">날짜 선택</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-blue-200/50 to-transparent"></div>
                    <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full backdrop-blur-sm">
                      {(() => {
                        const recentDays = getRecentDays();
                        const daysWithLogs = recentDays.filter(day => day.hasLogs).length;
                        return `${daysWithLogs}일 기록`;
                      })()}
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded-xl bg-white/60 backdrop-blur-sm p-3 border" style={{ borderColor: 'rgba(1, 19, 163, 0.1)' }}>
                    <motion.div
                      ref={dateScrollContainerRef}
                      className="flex space-x-2 cursor-grab active:cursor-grabbing"
                      style={{ 
                        x: sidebarDateX,
                        touchAction: 'pan-x'
                      }}
                      drag="x"
                      dragConstraints={{
                        left: -(Math.max(0, (getRecentDays().length * 85) - 200)),
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
                          const recentDays = getRecentDays();
                          const currentIndex = recentDays.findIndex(day => day.value === selectedDate);
                          
                          if (direction === 'next' && currentIndex < recentDays.length - 1) {
                            const nextDay = recentDays[currentIndex + 1];
                            if (nextDay.hasLogs) {
                              handleDateSelect(nextDay.value);
                              console.log('📅 [Sidebar] 다음 날짜로 변경:', nextDay.value);
                            }
                          } else if (direction === 'prev' && currentIndex > 0) {
                            const prevDay = recentDays[currentIndex - 1];
                            if (prevDay.hasLogs) {
                              handleDateSelect(prevDay.value);
                              console.log('📅 [Sidebar] 이전 날짜로 변경:', prevDay.value);
                            }
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
                      {getRecentDays().map((day, index) => (
                        <motion.button
                          key={day.value}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // 햅틱 피드백
                            try {
                              if ('vibrate' in navigator) {
                                navigator.vibrate([10]);
                              }
                            } catch (err) {
                              console.debug('햅틱 피드백 차단');
                            }
                            
                            if (day.hasLogs) {
                              console.log('[사이드바 날짜] 날짜 선택:', day.value);
                              handleDateSelect(day.value);
                            }
                          }}
                          data-calendar-swipe="true"
                          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-normal transition-all duration-300 min-w-[80px] focus:outline-none ${
                            selectedDate === day.value
                              ? 'text-white shadow-lg scale-105'
                              : day.hasLogs
                              ? 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md hover:scale-102 border'
                              : 'bg-gray-50/50 text-gray-400 line-through cursor-not-allowed border-gray-100'
                          }`}
                          style={selectedDate === day.value 
                            ? { backgroundColor: '#0113A3' }
                            : day.hasLogs
                            ? { borderColor: 'rgba(1, 19, 163, 0.1)' }
                            : { borderColor: 'rgba(156, 163, 175, 0.1)' }
                          }
                          disabled={!day.hasLogs && selectedDate !== day.value}
                        >
                          {day.display}
                        </motion.button>
                      ))}
                    </motion.div>
                  </div>
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
                <div className="h-full overflow-y-auto hide-scrollbar space-y-3 pb-16">
                  {groupMembers.length > 0 ? (
                    <motion.div variants={sidebarContentVariants} className="space-y-2">
                      {groupMembers.map((member, index) => (
                        <motion.div
                          key={member.id}
                          id={`member-${member.id}`}
                          variants={memberItemVariants}
                          whileHover={{ scale: 1.02, x: 3 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            handleMemberSelect(member.id, e);
                            // 사이드바는 닫지 않고 유지하여 장소 리스트를 볼 수 있도록 함
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
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 300 }}
                              >
                                <img 
                                  src={member.photo || getDefaultImage(member.mt_gender, member.original_index)}
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
                                {/* 활동 로그 표시 */}
                                <div className="flex items-center space-x-1">
                                  <span className="text-xs text-gray-500">📊</span>
                                  <span className={`text-xs font-normal ${
                                    member.isSelected ? 'text-gray-700' : 'text-gray-700'
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
                                
                                {/* 지난주 (오늘 기준 13일전~7일전) */}
                                <div className="mb-2">
                                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                    <span>지난주</span>
                                    <span className="text-xs text-gray-300">7일전</span>
                                  </div>
                                  <div className="grid grid-cols-7 gap-1.5">
                                    {Array.from({ length: 7 }, (_, index) => {
                                      const dayIndex = 13 - index; // 13일전부터 7일전까지
                                      const hasLog = (memberLogDistribution[member.id] || Array(14).fill(false))[13 - dayIndex];
                                      const date = new Date();
                                      date.setDate(date.getDate() - dayIndex);
                                      const isToday = dayIndex === 0;
                                      
                                      const dateString = format(date, 'yyyy-MM-dd');
                                      const isSelected = dateString === selectedDate && member.isSelected;
                                      
                                      // 디버깅용 로그 (첫 번째 항목만)
                                      if (index === 0 && member.id === groupMembers.find(m => m.isSelected)?.id) {
                                        console.log(`[네모 캘린더] 지난주 비교:`, {
                                          dateString,
                                          selectedDate,
                                          isSelected,
                                          dayIndex,
                                          hasLog
                                        });
                                      }
                                      
                                      return (
                                        <div
                                          key={`week1-${index}`}
                                          className={`w-3.5 h-3.5 transition-all duration-200 ${
                                            isSelected
                                              ? 'bg-gradient-to-br from-pink-500 to-rose-500 border border-pink-600 ring-2 ring-pink-300 shadow-md'
                                              : hasLog 
                                                ? 'bg-indigo-400/80 border border-indigo-500/30 cursor-pointer hover:bg-indigo-500/90 hover:scale-110' 
                                                : 'bg-gray-50 border border-gray-200/50'
                                          } ${isToday && !isSelected ? 'ring-1 ring-indigo-300' : ''}`}
                                          title={`${format(date, 'MM.dd(E)', { locale: ko })} - ${hasLog ? '활동 있음' : '활동 없음'}${isToday ? ' (오늘)' : ''}${isSelected ? ' (선택됨)' : hasLog ? ' (클릭하여 이동)' : ''}`}
                                          onClick={hasLog ? (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            const dateString = format(date, 'yyyy-MM-dd');
                                            console.log(`[활동 캘린더] 지난주 ${format(date, 'MM.dd(E)', { locale: ko })} 클릭 - 멤버: ${member.name}, 날짜 변경: ${dateString}`);
                                            console.log(`[활동 캘린더] 현재 선택된 날짜: ${selectedDate} → 새 날짜: ${dateString}`);
                                            
                                            // 클릭된 네모에 고급스러운 시각적 피드백
                                            const clickedElement = e.currentTarget as HTMLElement;
                                            clickedElement.style.transform = 'scale(1.2) translateY(-1px)';
                                            clickedElement.style.boxShadow = '0 8px 25px -5px rgba(236, 72, 153, 0.4), 0 0 0 3px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                            clickedElement.style.zIndex = '1000';
                                            clickedElement.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                                            
                                            // 해당 멤버가 선택되지 않은 경우 먼저 멤버 선택 후 날짜 변경
                                            if (!member.isSelected) {
                                              console.log(`[활동 캘린더] 멤버 ${member.name} 선택 + 날짜 변경: ${selectedDate} → ${dateString}`);
                                              handleMemberSelect(member.id);
                                              // 멤버 선택 후 날짜 변경
                                              setTimeout(() => {
                                                handleDateSelect(dateString);
                                              }, 100);
                                            } else {
                                              // 이미 선택된 멤버인 경우에만 날짜 변경
                                              if (dateString !== selectedDate) {
                                                console.log(`[활동 캘린더] 같은 멤버 - 날짜만 변경: ${selectedDate} → ${dateString}`);
                                                handleDateSelect(dateString);
                                              } else {
                                                console.log(`[활동 캘린더] 같은 멤버, 같은 날짜 - 변경 없음`);
                                              }
                                            }
                                            
                                            // 시각적 피드백 원복 (고급스러운 애니메이션)
                                            setTimeout(() => {
                                              clickedElement.style.transform = '';
                                              clickedElement.style.boxShadow = '';
                                              clickedElement.style.zIndex = '';
                                              clickedElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                                              
                                              // 트랜지션 완료 후 초기화
                                              setTimeout(() => {
                                                clickedElement.style.transition = '';
                                              }, 300);
                                            }, 250);
                                            
                                            // 햅틱 피드백 강화
                                            try {
                                              if ('vibrate' in navigator) {
                                                navigator.vibrate([10, 50, 10]);
                                              }
                                            } catch (err) {
                                              console.debug('햅틱 피드백 차단');
                                            }
                                          } : undefined}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                                
                                {/* 이번주 (오늘 기준 6일전~오늘) */}
                                <div className="mb-2">
                                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                    <span>이번주</span>
                                    <span className="text-xs text-indigo-600 font-medium">오늘까지</span>
                                  </div>
                                  <div className="grid grid-cols-7 gap-1.5">
                                    {Array.from({ length: 7 }, (_, index) => {
                                      const dayIndex = 6 - index; // 6일전부터 오늘까지
                                      const hasLog = (memberLogDistribution[member.id] || Array(14).fill(false))[13 - dayIndex];
                                      const date = new Date();
                                      date.setDate(date.getDate() - dayIndex);
                                      const isToday = dayIndex === 0;
                                      
                                      const dateString = format(date, 'yyyy-MM-dd');
                                      const isSelected = dateString === selectedDate && member.isSelected;
                                      
                                      // 디버깅용 로그 (첫 번째 항목만)
                                      if (index === 0 && member.id === groupMembers.find(m => m.isSelected)?.id) {
                                        console.log(`[네모 캘린더] 이번주 비교:`, {
                                          dateString,
                                          selectedDate,
                                          isSelected,
                                          dayIndex,
                                          hasLog,
                                          isToday
                                        });
                                      }
                                      
                                      return (
                                        <div
                                          key={`week2-${index}`}
                                          className={`w-3.5 h-3.5 transition-all duration-200 ${
                                            isSelected
                                              ? 'bg-gradient-to-br from-pink-500 to-rose-500 border border-pink-600 ring-2 ring-pink-300 shadow-md'
                                              : isToday 
                                                ? hasLog 
                                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-500 border border-indigo-600/50 ring-2 ring-indigo-200 shadow-sm' 
                                                  : 'bg-gradient-to-br from-gray-200 to-gray-300 border border-gray-300 ring-2 ring-indigo-200'
                                                : hasLog 
                                                  ? 'bg-indigo-500/90 border border-indigo-600/40 cursor-pointer hover:bg-indigo-600 hover:scale-110' 
                                                  : 'bg-gray-50 border border-gray-200/50'
                                          }`}
                                          title={`${format(date, 'MM.dd(E)', { locale: ko })} - ${hasLog ? '활동 있음' : '활동 없음'}${isToday ? ' (오늘)' : ''}${isSelected ? ' (선택됨)' : hasLog && !isToday ? ' (클릭하여 이동)' : ''}`}
                                          onClick={hasLog && !isToday ? (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            const dateString = format(date, 'yyyy-MM-dd');
                                            console.log(`[활동 캘린더] 이번주 ${format(date, 'MM.dd(E)', { locale: ko })} 클릭 - 멤버: ${member.name}, 날짜 변경: ${dateString}`);
                                            console.log(`[활동 캘린더] 현재 선택된 날짜: ${selectedDate} → 새 날짜: ${dateString}`);
                                            
                                            // 클릭된 네모에 고급스러운 시각적 피드백
                                            const clickedElement = e.currentTarget as HTMLElement;
                                            clickedElement.style.transform = 'scale(1.2) translateY(-1px)';
                                            clickedElement.style.boxShadow = '0 8px 25px -5px rgba(236, 72, 153, 0.4), 0 0 0 3px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                            clickedElement.style.zIndex = '1000';
                                            clickedElement.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                                            
                                            // 해당 멤버가 선택되지 않은 경우 먼저 멤버 선택 후 날짜 변경
                                            if (!member.isSelected) {
                                              console.log(`[활동 캘린더] 멤버 ${member.name} 선택 + 날짜 변경: ${selectedDate} → ${dateString}`);
                                              handleMemberSelect(member.id);
                                              // 멤버 선택 후 날짜 변경
                                              setTimeout(() => {
                                                handleDateSelect(dateString);
                                              }, 100);
                                            } else {
                                              // 이미 선택된 멤버인 경우에만 날짜 변경
                                              if (dateString !== selectedDate) {
                                                console.log(`[활동 캘린더] 같은 멤버 - 날짜만 변경: ${selectedDate} → ${dateString}`);
                                                handleDateSelect(dateString);
                                              } else {
                                                console.log(`[활동 캘린더] 같은 멤버, 같은 날짜 - 변경 없음`);
                                              }
                                            }
                                            
                                            // 시각적 피드백 원복 (고급스러운 애니메이션)
                                            setTimeout(() => {
                                              clickedElement.style.transform = '';
                                              clickedElement.style.boxShadow = '';
                                              clickedElement.style.zIndex = '';
                                              clickedElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                                              
                                              // 트랜지션 완료 후 초기화
                                              setTimeout(() => {
                                                clickedElement.style.transition = '';
                                              }, 300);
                                            }, 250);
                                            
                                            // 햅틱 피드백 강화
                                            try {
                                              if ('vibrate' in navigator) {
                                                navigator.vibrate([10, 50, 10]);
                                              }
                                            } catch (err) {
                                              console.debug('햅틱 피드백 차단');
                                            }
                                          } : undefined}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                                
                                {/* 요일 레이블 */}
                                <div className="grid grid-cols-7 gap-1.5">
                                  {(() => {
                                    const today = new Date();
                                    const todayDay = today.getDay(); // 0(일) ~ 6(토)
                                    const days = ['일', '월', '화', '수', '목', '금', '토'];
                                    
                                    return Array.from({ length: 7 }, (_, index) => {
                                      // 오늘 기준으로 요일 배열 생성
                                      const dayIndex = (todayDay - 6 + index + 7) % 7;
                                      const isToday = index === 6; // 마지막이 오늘
                                      
                                      return (
                                        <div key={index} className="w-3.5 flex justify-center">
                                          <span className={`text-xs ${isToday ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`} style={{ fontSize: '9px' }}>
                                            {days[dayIndex]}
                                          </span>
                                        </div>
                                      );
                                    });
                                  })()}
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
    </>
  );
} 