'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, useMotionValue } from 'framer-motion';
import { PageContainer, Button } from '../components/layout';
import { FiPlus, FiTrendingUp, FiClock, FiZap, FiPlayCircle, FiSettings, FiUser, FiLoader, FiChevronDown } from 'react-icons/fi';
import { API_KEYS, MAP_CONFIG } from '../../config'; 
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import memberService from '@/services/memberService';

import groupService, { Group } from '@/services/groupService';
import memberLocationLogService, { LocationLog, LocationSummary as APILocationSummary, LocationPathData, DailySummary, StayTime, MapMarker, LocationLogSummary, DailyCountsResponse, MemberActivityResponse, MemberDailyCount } from '@/services/memberLocationLogService';

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
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
    width: 52px; 
    height: 52px; 
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

// 전역 실행 제어 - 한 번만 실행되도록 보장
let globalPageExecuted = false;
let globalComponentInstances = 0;

export default function LogsPage() {
  const router = useRouter();
  
  // 인증 관련 상태 추가 (home/page.tsx와 동일)
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  // UserContext 사용
  const { userInfo, userGroups, isUserDataLoading, userDataError, refreshUserData } = useUser();
  
  // home/page.tsx와 동일한 상태들 추가
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);

  
  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  
  // 데이터 fetch 상태 관리
  const dataFetchedRef = useRef({ members: false });
  
  // 컴포넌트 인스턴스별 실행 제어
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const hasExecuted = useRef(false);
  const isMainInstance = useRef(false);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [previousDate, setPreviousDate] = useState<string | null>(null); // 이전 날짜 추적
  const isDateChangedRef = useRef<boolean>(false); // 날짜 변경 플래그
  const loadLocationDataExecutingRef = useRef<{ executing: boolean; lastExecution?: number }>({ executing: false }); // loadLocationData 중복 실행 방지
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); 
  const memberNaverMarkers = useRef<any[]>([]); 
  const locationLogMarkers = useRef<any[]>([]); // 위치 로그 마커들을 위한 ref
  const locationLogPolyline = useRef<any>(null); // 위치 로그 연결선을 위한 ref
  const startEndMarkers = useRef<any[]>([]); // 시작/종료 마커들을 위한 ref
  const stayTimeMarkers = useRef<any[]>([]); // 체류시간 마커들을 위한 ref 
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); 
  const [isMapInitializedLogs, setIsMapInitializedLogs] = useState(false); // Logs 페이지용 지도 초기화 상태
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false); // 초기 데이터 로딩 상태 추가

  // 첫 진입 애니메이션 상태 관리
  const [showHeader, setShowHeader] = useState(true);
  const [showDateSelection, setShowDateSelection] = useState(false);

  // home/page.tsx와 동일한 바텀시트 상태 관리
  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'expanded'>('expanded');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const startDragX = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const hasUserInteracted = useRef<boolean>(false); // 사용자 상호작용 추적

  // 로그 페이지 뷰 상태 및 Ref
  const [activeLogView, setActiveLogView] = useState<'members' | 'summary'>('members');
  const logSwipeContainerRef = useRef<HTMLDivElement>(null);
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
  
  const [sliderValue, setSliderValue] = useState(60); // 슬라이더 초기 값 (0-100)
  const dateScrollContainerRef = useRef<HTMLDivElement>(null); // 날짜 스크롤 컨테이너 Ref 추가

  // 바텀시트 variants - collapsed/expanded 상태만 사용
  const bottomSheetVariants = {
    collapsed: { 
      translateY: '75%',
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 40,
        mass: 0.8,
        duration: 0.8
      }
    },
    expanded: {
      translateY: '-15px',
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 40,
        mass: 0.8,
        duration: 0.8
      }
    }
  };

  // 초기 데이터 로딩 시뮬레이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialDataLoaded(true);
    }, 1000); // 1초 후 초기 데이터 로딩 완료

    return () => clearTimeout(timer);
  }, []);

  // 첫 진입 시 헤더 애니메이션 제어
  useEffect(() => {
    if (isInitialDataLoaded && !isMapLoading && isMapInitializedLogs) {
      // 2초 후 헤더 숨기고 동시에 날짜선택 섹션 표시
      const headerTimer = setTimeout(() => {
        setShowHeader(false);
        setShowDateSelection(true); // 동시에 실행
      }, 2000);

      return () => clearTimeout(headerTimer);
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
  }, []);

  useEffect(() => {
    loadNaverMapsAPI();
  }, []);

  useEffect(() => {
    if (naverMapsLoaded && mapContainer.current && !map.current) {
      setIsMapLoading(true);
      try {
        const initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
            center: initialCenter,
            zoom: MAP_CONFIG.NAVER.DEFAULT_OPTIONS?.zoom || 10, 
            logoControl: false,
            mapDataControl: false,
        };
        map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);
        window.naver.maps.Event.addListener(map.current, 'init', () => {
            console.log('Naver Map initialized for LogsPage');
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
      
      // 지도 파괴
      if (map.current && typeof map.current.destroy === 'function') {
         map.current.destroy();
      }
      map.current = null;
    };
  }, [naverMapsLoaded]);

  const getRecentDays = useCallback(() => {
    const recentDays = Array.from({ length: 15 }, (_, i) => { // 오늘부터 14일전까지 (오늘 포함 15일)
      const date = subDays(new Date(), 14 - i);
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
      
      if (i === 14) {
        displayString = `오늘(${format(date, 'E', { locale: ko })})`;
      } else if (i === 13) {
        displayString = `어제(${format(date, 'E', { locale: ko })})`;
      } 

      return {
        value: dateString,
        display: displayString,
        hasLogs: hasLogs,
        count: dayCount,
      };
    });
    
    return recentDays;
  }, [groupMembers, dailyCountsData]);

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
    const deltaTime = performance.now() - dragStartTime.current;
    
    // 50ms 이상 지나고 10px 이상 움직였을 때만 방향 판단
    if (deltaTime > 50 && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      if (isHorizontalSwipeRef.current === null) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5; // 수평 스와이프 임계값 완화
        isHorizontalSwipeRef.current = isHorizontal;
      }
    }
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

    // 상하 드래그에 대한 바텀시트 상태 변경 (collapsed/expanded만)
    if (isHorizontalSwipeRef.current === false || isHorizontalSwipeRef.current === null) {
      const startTime = (e.target as any)._startedAt || performance.now() - 200;
      const duration = performance.now() - startTime;
      const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;
      
      const dragThreshold = 50;
      const velocityThreshold = 0.3;
      
      let nextState: 'collapsed' | 'expanded' = bottomSheetState;
    
      // 위로 드래그 (Y 감소) - 확장
      if (dragDeltaY < 0 && bottomSheetState === 'collapsed' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
        nextState = 'expanded';
        console.log('[DragEnd] 위로 드래그 감지 (collapsed -> expanded)');
          triggerHaptic();
        }
      // 아래로 드래그 (Y 증가) - 축소
      else if (dragDeltaY > 0 && bottomSheetState === 'expanded' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
        nextState = 'collapsed';
        console.log('[DragEnd] 아래로 드래그 감지 (expanded -> collapsed)');
          triggerHaptic();
      }
      
      // 상태 업데이트
      if (nextState !== bottomSheetState) {
        setBottomSheetState(nextState);
        console.log('[DragEnd] 상태 변경:', bottomSheetState, '->', nextState);
      } else {
        console.log('[DragEnd] 임계값 미달, 현재 상태 유지:', bottomSheetState);
      }
    }
    
    // 초기화
    isDraggingRef.current = false;
    startDragY.current = null;
    startDragX.current = null;
    dragStartTime.current = null;
    isHorizontalSwipeRef.current = null;
    (e.target as any)._startedAt = 0;
  };

  const toggleBottomSheet = () => {
    setBottomSheetState(prev => {
      const next = prev === 'collapsed' ? 'expanded' : 'collapsed';
      console.log('[BOTTOM_SHEET] toggleBottomSheet 상태 변경:', prev, '→', next);
      return next;
    });
  };

  const handleMemberSelect = (id: string, e: React.MouseEvent) => {
    // 이벤트 전파 중단 (이벤트 객체가 유효한 경우에만)
    if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    }
    if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
    }
    
    console.log('Member selection started:', id);
    
    // 멤버 변경 시 즉시 지도 초기화 (다른 멤버 선택 시에만)
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    const isChangingMember = !currentSelectedMember || currentSelectedMember.id !== id;
    
    if (isChangingMember) {
      clearMapMarkersAndPaths();
      console.log('[handleMemberSelect] 멤버 변경으로 지도 초기화 완료');
    }
    
    // 멤버 재선택 시 날짜 변경 플래그 리셋 (멤버 위치 기준 지도 조정 허용)
    if (isDateChangedRef.current) {
      isDateChangedRef.current = false;
      console.log('[handleMemberSelect] 멤버 재선택으로 날짜 변경 플래그 리셋');
    }
    
    // 현재 바텀시트 상태 유지
    const currentBottomSheetState = bottomSheetState;
    
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
    setActiveLogView('members');
    
    // 멤버 선택 시 날짜 스크롤 위치 조정
    setTimeout(() => scrollToTodayDate('멤버 선택'), 100);
    
    // 바텀시트 상태 유지
    setBottomSheetState(currentBottomSheetState);
    
    // 선택 상태 변경 확인을 위한 로그
    const selectedMember = updatedMembers.find(m => m.isSelected);
    console.log('[handleMemberSelect] Selected member:', selectedMember?.name);
    
    // loadLocationData는 useEffect에서 처리되도록 제거
    console.log('[handleMemberSelect] 멤버 선택 완료 - useEffect에서 지도 업데이트 및 데이터 로딩 처리됨');
  };

  // 위치 로그 마커를 지도에 업데이트하는 함수
  const updateLocationLogMarkers = (markers: MapMarker[]) => {
    if (!map.current || !window.naver?.maps) {
      console.log('[updateLocationLogMarkers] 지도가 준비되지 않음');
      return;
    }

    console.log('[updateLocationLogMarkers] 위치 로그 마커 업데이트 시작:', markers.length, '개');
    console.log('[updateLocationLogMarkers] 첫 번째 마커 데이터:', markers[0]);

    // 기존 위치 로그 마커들 제거
    locationLogMarkers.current.forEach((marker) => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    locationLogMarkers.current = [];

    // 기존 위치 로그 연결선 제거
    if (locationLogPolyline.current) {
      locationLogPolyline.current.setMap(null);
      locationLogPolyline.current = null;
    }

    // 기존 시작/종료 마커들 제거
    startEndMarkers.current.forEach((marker) => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    startEndMarkers.current = [];

    if (markers.length === 0) {
      console.log('[updateLocationLogMarkers] 표시할 마커가 없음');
      return;
    }

    // 위치 로그와 체류지점을 시간 순서로 통합
    const allTimePoints: Array<{
      type: 'location' | 'stay';
      data: any;
      lat: number;
      lng: number;
      time: string;
      sortKey: number;
    }> = [];
    
    // 위치 로그 데이터 추가
    markers.forEach((markerData, index) => {
      // 변환된 API 응답 형식과 기존 형식 모두 지원
      const lat = markerData.latitude || markerData.mlt_lat;
      const lng = markerData.longitude || markerData.mlt_long;
      const time = markerData.timestamp || markerData.mlt_gps_time || new Date().toISOString();
      const sortKey = markerData.id || markerData.mlt_idx || index;
      
      if (!lat || !lng) {
        console.warn('[updateLocationLogMarkers] 유효하지 않은 위치 데이터:', index, markerData);
        return;
      }
      
      allTimePoints.push({
        type: 'location',
        data: markerData,
        lat: Number(lat),
        lng: Number(lng),
        time: time,
        sortKey: Number(sortKey)
      });
    });
    
    // 체류지점 데이터 추가
    stayTimesData.forEach((stayData) => {
      allTimePoints.push({
        type: 'stay',
        data: stayData,
        lat: stayData.latitude || stayData.start_lat || 0,
        lng: stayData.longitude || stayData.start_long || 0,
        time: stayData.start_time,
        sortKey: new Date(stayData.start_time).getTime() // 시간으로 정렬
      });
    });
    
    // 시간 순서로 정렬 (mlt_idx와 시간을 모두 고려)
    const sortedTimePoints = allTimePoints.sort((a, b) => {
      if (a.type === 'location' && b.type === 'location') {
        return a.sortKey - b.sortKey; // 위치 로그끼리는 mlt_idx로 정렬
      }
      // 시간으로 비교
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeA - timeB;
    });
    
    // 위치 로그만 따로 추출 (기존 마커 생성용)
    const sortedMarkers = sortedTimePoints
      .filter(point => point.type === 'location')
      .map(point => point.data);

    // 새로운 위치 로그 마커들 생성
    console.log('[updateLocationLogMarkers] 마커 생성 시작:', sortedMarkers.length, '개');
    sortedMarkers.forEach((markerData, index) => {
      try {
        if (index < 3) { // 처음 3개만 로그
          console.log(`[updateLocationLogMarkers] 마커 ${index} 생성:`, {
            lat: markerData.mlt_lat,
            lng: markerData.mlt_long,
            time: markerData.mlt_gps_time
          });
        }
        // 변환된 API 응답 형식과 기존 형식 모두 지원
        const lat = markerData.latitude || markerData.mlt_lat || 0;
        const lng = markerData.longitude || markerData.mlt_long || 0;
        const speed = markerData.speed || markerData.mlt_speed || 0;
        const accuracy = markerData.accuracy || markerData.mlt_accuacy || 0;
        const battery = markerData.battery_level || markerData.mlt_battery || 0;
        // 걸음수는 위치로그 요약 데이터에서 가져오기 (개별 마커에는 없음)
        const steps = locationLogSummaryData?.steps || 0;
        const timestamp = markerData.timestamp || markerData.mlt_gps_time || '정보 없음';
        
        // 시간에서 날짜 부분 제거 (시간만 표시)
        const timeOnly = timestamp === '정보 없음' ? '정보 없음' : 
          timestamp.includes('T') ? timestamp.split('T')[1]?.substring(0, 8) || timestamp :
          timestamp.includes(' ') ? timestamp.split(' ')[1] || timestamp :
          timestamp;
        
        // 디버깅을 위한 데이터 로깅 (처음 3개만)
        if (index < 3) {
          console.log(`[updateLocationLogMarkers] 마커 ${index} 원본 데이터:`, markerData);
          console.log(`[updateLocationLogMarkers] 마커 ${index} 파싱된 데이터:`, {
            lat, lng, speed, accuracy, battery, steps, timestamp
          });
        }
        
        const position = new window.naver.maps.LatLng(Number(lat), Number(lng));
        
        // 속도에 따른 마커 색상 결정
        let markerColor = '#3b82f6'; // 기본 파란색
        if (speed > 5) {
          markerColor = '#ef4444'; // 빠른 속도 - 빨간색
        } else if (speed > 2) {
          markerColor = '#f59e0b'; // 중간 속도 - 주황색
        } else if (speed > 0.5) {
          markerColor = '#10b981'; // 느린 속도 - 초록색
        }

        // 위치 로그 마커 생성 (작은 원형 마커)
        const marker = new window.naver.maps.Marker({
          position: position,
          map: map.current,
          icon: {
            content: `
              <div style="
                width: 8px; 
                height: 8px; 
                background: ${markerColor}; 
                border: 2px solid white; 
                border-radius: 50%; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                cursor: pointer;
              "></div>
            `,
            anchor: new window.naver.maps.Point(6, 6)
          },
          zIndex: 100 + index
        });

        // 마커 클릭 이벤트 - 상세 정보 표시 (home/page.tsx 스타일과 애니메이션 적용)
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
              
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px; text-align: center;">
                📍 위치 로그
              </h3>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🕒 시간: <span style="color: #111827; font-weight: 500;">${timeOnly}</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🚶 속도: <span style="color: #111827; font-weight: 500;">${speed.toFixed(2)} km/h</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  📍 정확도: <span style="color: #111827; font-weight: 500;">${accuracy.toFixed(1)}m</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🔋 배터리: <span style="color: #111827; font-weight: 500;">${battery}%</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  📍 위치점 번호: <span style="color: #111827; font-weight: 500;">#${index + 1}</span>
                </p>
              </div>
              <div style="margin-bottom: 0;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  🌍 좌표: ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </p>
              </div>
            </div>
          `,
          borderWidth: 0,
          backgroundColor: 'transparent',
          disableAnchor: true,
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infoWindow.getMap()) {
            infoWindow.close();
          } else {
            infoWindow.open(map.current, marker);
          }
        });

        locationLogMarkers.current.push(marker);
      } catch (error) {
        console.error('[updateLocationLogMarkers] 마커 생성 오류:', error, markerData);
      }
    });

    console.log('[updateLocationLogMarkers] 위치 로그 마커 생성 완료:', locationLogMarkers.current.length, '개');

    // 시간 순서대로 모든 지점을 연결하는 Polyline 생성
    if (sortedTimePoints.length > 1) {
      const pathCoordinates = sortedTimePoints.map(point => 
        new window.naver.maps.LatLng(point.lat, point.lng)
      );

      locationLogPolyline.current = new window.naver.maps.Polyline({
        map: map.current,
        path: pathCoordinates,
        strokeColor: '#3b82f6', // 파란색 선
        strokeOpacity: 0.8,
        strokeWeight: 3,
        strokeStyle: 'solid'
      });

      // 각 마커 사이에 방향을 나타내는 화살표 추가
      for (let i = 0; i < sortedTimePoints.length - 1; i++) {
        const currentPoint = sortedTimePoints[i];
        const nextPoint = sortedTimePoints[i + 1];
        
        // 두 점 사이의 중점 계산
        const midLat = (currentPoint.lat + nextPoint.lat) / 2;
        const midLng = (currentPoint.lng + nextPoint.lng) / 2;
        
        // 방향 계산 (현재 지점에서 다음 지점으로의 각도)
        const deltaLat = nextPoint.lat - currentPoint.lat;
        const deltaLng = nextPoint.lng - currentPoint.lng;
        // Math.atan2는 동쪽이 0도, CSS rotate는 북쪽이 0도이므로 -90도 보정
        const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
        
        // 화살표 마커 생성
        const arrowMarker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(midLat, midLng),
          map: map.current,
          icon: {
            content: `
              <div style="
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 10px solid white;
                border-top: none;
                transform: rotate(${angle}deg);
                transform-origin: center center;
                opacity: 0.9;
                cursor: pointer;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
              "></div>
            `,
            anchor: new window.naver.maps.Point(5, 5)
          },
          zIndex: 50
        });
        
        locationLogMarkers.current.push(arrowMarker);
      }

      console.log('[updateLocationLogMarkers] 통합 경로 연결선 및 화살표 생성 완료:', pathCoordinates.length, '개 좌표,', sortedTimePoints.length - 1, '개 화살표');
    }

    // 시작점과 종료점에 특별한 마커 추가 (통합된 시간 기준)
    if (sortedTimePoints.length > 0) {
      const startPoint = sortedTimePoints[0];
      const endPoint = sortedTimePoints[sortedTimePoints.length - 1];

      // 시작점 마커 (초록색 원형 마커)
      const startPosition = new window.naver.maps.LatLng(startPoint.lat, startPoint.lng);
      const startIcon = new window.naver.maps.Marker({
        position: startPosition,
        map: map.current,
        icon: {
          content: `
            <div style="
              width: 20px; 
              height: 20px; 
              background: #22c55e; 
              border: 3px solid white; 
              border-radius: 50%; 
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 10px;
              color: white;
            ">S</div>
          `,
          anchor: new window.naver.maps.Point(13, 13)
        },
        zIndex: 300
      });

      // 시작점 InfoWindow
      const startInfoWindow = new window.naver.maps.InfoWindow({
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
            
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #22c55e; padding-right: 25px; text-align: center;">
              🚀 시작 지점
            </h3>
            <div style="margin-bottom: 6px;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                                  🕒 시간: <span style="color: #111827; font-weight: 500;">${startPoint.time ? startPoint.time.split(' ')[1] || startPoint.time : '정보 없음'}</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🚶 속도: <span style="color: #111827; font-weight: 500;">${startPoint.type === 'location' ? (startPoint.data.mlt_speed?.toFixed(2) || 0) : 0} km/h</span>
                </p>
              </div>
              <div style="margin-bottom: 0;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  🌍 좌표: ${startPoint.lat ? startPoint.lat.toFixed(6) : '0.000000'}, ${startPoint.lng ? startPoint.lng.toFixed(6) : '0.000000'}
              </p>
            </div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: true,
        pixelOffset: new window.naver.maps.Point(0, -10)
      });

      window.naver.maps.Event.addListener(startIcon, 'click', () => {
        if (startInfoWindow.getMap()) {
          startInfoWindow.close();
        } else {
          startInfoWindow.open(map.current, startIcon);
        }
      });

      startEndMarkers.current.push(startIcon);

              // 종료점 마커 (빨간색 원형 마커) - 시작점과 다른 경우에만
        if (sortedTimePoints.length > 1) {
          const endPosition = new window.naver.maps.LatLng(endPoint.lat, endPoint.lng);
          const endIcon = new window.naver.maps.Marker({
            position: endPosition,
            map: map.current,
            icon: {
              content: `
                <div style="
                  width: 20px; 
                  height: 20px; 
                  background: #ef4444; 
                  border: 3px solid white; 
                  border-radius: 50%; 
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 10px;
                  color: white;
                ">E</div>
              `,
              anchor: new window.naver.maps.Point(13, 13)
            },
            zIndex: 300
          });

          // 종료점 InfoWindow
          const endInfoWindow = new window.naver.maps.InfoWindow({
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
                
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ef4444; padding-right: 25px; text-align: center;">
                  🏁 종료 지점
                </h3>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🕒 시간: <span style="color: #111827; font-weight: 500;">${endPoint.time ? endPoint.time.split(' ')[1] || endPoint.time : '정보 없음'}</span>
                  </p>
                </div>
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    🚶 속도: <span style="color: #111827; font-weight: 500;">${endPoint.type === 'location' ? (endPoint.data.mlt_speed?.toFixed(2) || 0) : 0} km/h</span>
                  </p>
                </div>
                <div style="margin-bottom: 0;">
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    🌍 좌표: ${endPoint.lat ? endPoint.lat.toFixed(6) : '0.000000'}, ${endPoint.lng ? endPoint.lng.toFixed(6) : '0.000000'}
                  </p>
                </div>
              </div>
            `,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true,
            pixelOffset: new window.naver.maps.Point(0, -10)
          });

          window.naver.maps.Event.addListener(endIcon, 'click', () => {
            if (endInfoWindow.getMap()) {
              endInfoWindow.close();
            } else {
              endInfoWindow.open(map.current, endIcon);
            }
          });

          startEndMarkers.current.push(endIcon);
        }

      console.log('[updateLocationLogMarkers] 시작/종료 마커 생성 완료');
    }

    // 체류시간 마커도 업데이트 (시작/종료점 정보 전달)
    if (stayTimesData.length > 0) {
      const startEndPoints = sortedTimePoints.length > 0 ? {
        start: sortedTimePoints[0],
        end: sortedTimePoints[sortedTimePoints.length - 1]
      } : undefined;
      
      updateStayTimeMarkers(stayTimesData, startEndPoints);
    }

    // 모든 마커들(위치로그 + 체류시간)이 보이도록 지도 범위 조정 및 중심 이동
    if (sortedTimePoints.length > 0) {
      const bounds = new window.naver.maps.LatLngBounds();
      
      // 모든 시간 기준 지점들을 범위에 포함
      sortedTimePoints.forEach(point => {
        bounds.extend(new window.naver.maps.LatLng(point.lat, point.lng));
      });
      
      // 부드럽게 지도 범위 조정 및 중심 이동
      try {
        // fitBounds 후 적절한 줌 레벨 설정
        map.current.fitBounds(bounds, {
          top: 60,
          right: 60,
          bottom: 60,
          left: 60
        });

        // 날짜 변경 시에는 시작지점 기준 지도 조정을 우선하므로 경로 중심 이동 건너뜀
        // 멤버가 선택된 상태에서는 경로 중심 이동 건너뜀 (멤버 위치 기준 조정 우선)
        const hasMemberSelected = groupMembers.some(m => m.isSelected);
        if (!isDateChangedRef.current && !hasMemberSelected) {
          // 약간의 지연 후 중심점으로 부드럽게 이동
          setTimeout(() => {
            if (map.current && bounds) {
              const center = bounds.getCenter();
              map.current.panTo(center); // setCenter 대신 panTo 사용으로 부드러운 이동
              console.log('[updateLocationLogMarkers] 지도 중심 이동 완료:', center);
            }
          }, 200);
        } else {
          console.log('[updateLocationLogMarkers] 날짜 변경 중이거나 멤버 선택됨 - 경로 중심 이동 건너뜀');
        }
      } catch (error) {
        console.error('[updateLocationLogMarkers] 지도 범위 조정 중 오류:', error);
      }
    }
  };

  // 체류시간 마커를 지도에 업데이트하는 함수
  const updateStayTimeMarkers = (stayTimes: StayTime[], startEndPoints?: { start?: any, end?: any }) => {
    if (!map.current || !window.naver?.maps) {
      console.log('[updateStayTimeMarkers] 지도가 준비되지 않음');
      return;
    }

    console.log('[updateStayTimeMarkers] 체류시간 마커 업데이트 시작:', stayTimes.length, '개');

    // 기존 체류시간 마커들 제거
    stayTimeMarkers.current.forEach((marker) => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    stayTimeMarkers.current = [];

    if (stayTimes.length === 0) {
      console.log('[updateStayTimeMarkers] 표시할 체류시간 마커가 없음');
      return;
    }

    // 체류시간에 따른 마커 크기와 색상 결정 함수
    const getMarkerStyle = (duration: number, index: number) => {
      let size = 30; // 기본 크기
      let bgColor = '#f59e0b'; // 기본 주황색
      let textColor = 'white';
      
      // 체류시간에 따른 크기 조정
      if (duration >= 300) { // 5시간 이상
        size = 40;
        bgColor = '#dc2626'; // 빨간색 (가장 긴 체류)
      } else if (duration >= 120) { // 2시간 이상
        size = 36;
        bgColor = '#ea580c'; // 진한 주황색
      } else if (duration >= 60) { // 1시간 이상
        size = 32;
        bgColor = '#f59e0b'; // 주황색
      } else if (duration >= 30) { // 30분 이상
        size = 28;
        bgColor = '#eab308'; // 노란색
      } else { // 30분 미만
        size = 26;
        bgColor = '#22c55e'; // 초록색 (짧은 체류)
      }

      return { size, bgColor, textColor };
    };

    // 체류시간 포맷 함수
    const formatDuration = (minutes: number): string => {
      // NaN이나 유효하지 않은 값 처리
      if (isNaN(minutes) || !isFinite(minutes) || minutes < 0) {
        return '정보 없음';
      }
      
      const hours = Math.floor(minutes / 60);
      const mins = Math.floor(minutes % 60);
      
      if (hours > 0) {
        return `${hours}시간 ${mins}분`;
      } else {
        return `${mins}분`;
      }
    };

    // 실제 체류지점 데이터를 시간 순서로 정렬
    const sortedStayTimes = [...stayTimes].sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeA - timeB;
    });

    // 시작점/종료점과 겹치는 체류지점 필터링 함수
    const isOverlapping = (stayPoint: StayTime, comparePoint: any): boolean => {
      if (!comparePoint) return false;
      
      const lat1 = stayPoint.latitude || stayPoint.start_lat || 0;
      const lng1 = stayPoint.longitude || stayPoint.start_long || 0;
      const lat2 = comparePoint.lat || 0;
      const lng2 = comparePoint.lng || 0;
      
      // 좌표 차이 (약 10m 이내면 같은 지점으로 간주)
      const latDiff = Math.abs(lat1 - lat2);
      const lngDiff = Math.abs(lng1 - lng2);
      const threshold = 0.0001; // 약 10-11m 정도의 오차범위
      
      return latDiff < threshold && lngDiff < threshold;
    };

    // 시작점/종료점과 겹치지 않는 체류지점만 필터링
    const filteredStayTimes = sortedStayTimes.filter(stayPoint => {
      const overlapWithStart = startEndPoints?.start && isOverlapping(stayPoint, startEndPoints.start);
      const overlapWithEnd = startEndPoints?.end && isOverlapping(stayPoint, startEndPoints.end);
      
      if (overlapWithStart || overlapWithEnd) {
        console.log('[updateStayTimeMarkers] 체류지점이 시작/종료점과 겹쳐서 제외됨:', stayPoint);
        return false;
      }
      return true;
    });

    // 필터링된 체류시간 마커들 생성 (연속된 번호로)
    filteredStayTimes.forEach((stayData, index) => {
      try {
        // 변환된 API 응답 형식과 기존 형식 모두 지원
        const lat = stayData.latitude || stayData.start_lat;
        const lng = stayData.longitude || stayData.start_long;
        
        // 유효하지 않은 위치 데이터 건너뛰기
        if (!lat || !lng || lat === 0 || lng === 0) {
          console.warn('[updateStayTimeMarkers] 유효하지 않은 체류시간 위치 데이터:', index, stayData);
          return;
        }
        
        const position = new window.naver.maps.LatLng(Number(lat), Number(lng));
        
        // 체류시간 계산 (변환된 형식과 기존 형식 모두 지원)
        let durationMinutes = 0;
        
        console.log(`[updateStayTimeMarkers] 체류시간 데이터 ${index}:`, {
          duration: stayData.duration,
          stay_duration: stayData.stay_duration,
          stayData: stayData
        });
        
        // 숫자 형식 체류시간 (분 단위)
        if (typeof stayData.duration === 'number' && !isNaN(stayData.duration)) {
          durationMinutes = stayData.duration;
        }
        // 문자열 형식 체류시간 ("HH:MM:SS" 또는 "MM:SS")
        else if (stayData.stay_duration && typeof stayData.stay_duration === 'string') {
          const timeParts = stayData.stay_duration.split(':');
          if (timeParts.length >= 2) {
            if (timeParts.length === 3) {
              // "HH:MM:SS" 형식
              const hours = parseInt(timeParts[0]) || 0;
              const minutes = parseInt(timeParts[1]) || 0;
              const seconds = parseFloat(timeParts[2]) || 0;
              durationMinutes = hours * 60 + minutes + seconds / 60;
            } else if (timeParts.length === 2) {
              // "MM:SS" 형식
              const minutes = parseInt(timeParts[0]) || 0;
              const seconds = parseFloat(timeParts[1]) || 0;
              durationMinutes = minutes + seconds / 60;
            }
          }
        }
        
        console.log(`[updateStayTimeMarkers] 계산된 체류시간 ${index}:`, durationMinutes, '분');
        
        const markerStyle = getMarkerStyle(durationMinutes, index);
        const markerNumber = index + 1; // 연속된 번호 (1부터 시작)

        // 체류시간 마커 생성 (순서 번호가 있는 원형 마커)
        const marker = new window.naver.maps.Marker({
          position: position,
          map: map.current,
          icon: {
            content: `
              <div style="
                position: relative;
                width: ${markerStyle.size}px; 
                height: ${markerStyle.size}px; 
                background: ${markerStyle.bgColor}; 
                border: 3px solid white; 
                border-radius: 50%; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: ${markerStyle.size > 32 ? '14px' : '12px'};
                color: ${markerStyle.textColor};
              ">
                ${markerNumber}
                                 <div style="
                   position: absolute;
                   top: -20px;
                   right: -20px;
                   background: #1f2937;
                   color: white;
                   border-radius: 8px;
                   padding: 2px 4px;
                   font-size: 10px;
                   font-weight: normal;
                   white-space: nowrap;
                   box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                 ">${formatDuration(durationMinutes)}</div>
              </div>
            `,
            anchor: new window.naver.maps.Point(markerStyle.size/2, markerStyle.size/2)
          },
          zIndex: 200 + index // 체류시간 마커가 위치 로그 마커보다 위에 표시
        });

        // 마커 클릭 이벤트 - 상세 정보 표시 (home/page.tsx 스타일과 애니메이션 적용)
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
              
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px; text-align: center;">
                🏠 체류 지점 #${markerNumber}
              </h3>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🕐 시작: <span style="color: #111827; font-weight: 500;">${stayData.start_time.split(' ')[1]}</span>
                </p>
              </div>
              <div style="margin-bottom: 6px;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  🕐 종료: <span style="color: #111827; font-weight: 500;">${stayData.end_time.split(' ')[1]}</span>
                </p>
              </div>
              <div style="margin-bottom: 0;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  ⏱️ 체류시간: <span style="
                    color: ${markerStyle.bgColor}; 
                    font-weight: bold; 
                    background: ${markerStyle.bgColor}20; 
                    padding: 4px 8px; 
                    border-radius: 8px;
                  ">${formatDuration(durationMinutes)}</span>
                </p>
              </div>
            </div>
          `,
          borderWidth: 0,
          backgroundColor: 'transparent',
          disableAnchor: true,
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infoWindow.getMap()) {
            infoWindow.close();
          } else {
            infoWindow.open(map.current, marker);
          }
        });

        stayTimeMarkers.current.push(marker);
      } catch (error) {
        console.error('[updateStayTimeMarkers] 마커 생성 오류:', error, stayData);
      }
    });

    console.log('[updateStayTimeMarkers] 체류시간 마커 생성 완료:', stayTimeMarkers.current.length, '개 (필터링 전:', sortedStayTimes.length, '개)');

    // 체류시간 마커들이 모두 보이도록 지도 범위 조정
    if (filteredStayTimes.length > 0) {
      const bounds = new window.naver.maps.LatLngBounds();
      filteredStayTimes.forEach(stayData => {
        const lat = stayData.latitude || stayData.start_lat || 0;
        const lng = stayData.longitude || stayData.start_long || 0;
        if (lat && lng && lat !== 0 && lng !== 0) {
          bounds.extend(new window.naver.maps.LatLng(lat, lng));
        }
      });
      
      // 부드럽게 지도 범위 조정
      map.current.fitBounds(bounds, {
        top: 80,
        right: 80,
        bottom: 80,
        left: 80
      });
    }
  };

  const updateMemberMarkers = (members: GroupMember[], isDateChange: boolean = false) => {
    // 지도 초기화 체크 로직 개선
    if (!map.current) {
      console.warn('Map is not initialized');
      return;
    }
    
    if (!window.naver?.maps) {
      console.warn('Naver Maps API is not loaded');
      return;
    }
    
    // 기존 마커 제거
    memberNaverMarkers.current.forEach(marker => marker.setMap(null));
    memberNaverMarkers.current = [];
    
    const selectedMembers = members.filter(member => member.isSelected);
    
    // 선택된 멤버가 있는 경우에만 마커 생성 및 지도 이동
    if (selectedMembers.length > 0) {
      selectedMembers.forEach(member => {
        try {
          const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
          // 안전한 이미지 URL 사용
          const safeImageUrl = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
          // 선택된 멤버는 핑크색 border, 그렇지 않으면 인디고 border
          const borderColor = member.isSelected ? '#EC4899' : '#4F46E5';
          const marker = new window.naver.maps.Marker({
            position: position,
            map: map.current,
            icon: {
              content: `<div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                  <img src="${safeImageUrl}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${getDefaultImage(member.mt_gender, member.original_index)}'" />
                </div>
                <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">
                  ${member.name}
                </div>
              </div>`,
              size: new window.naver.maps.Size(36, 48),
              anchor: new window.naver.maps.Point(18, 42)
            },
            zIndex: member.isSelected ? 200 : 150 // 선택된 멤버가 위에 표시되도록
          });
          memberNaverMarkers.current.push(marker);
        } catch (error) {
          console.error('Error creating marker:', error);
        }
      });

      // 단일 멤버 선택 시 해당 위치로 지도 이동 (멤버 위치보다 200px 아래로 중심 이동)
      if (selectedMembers.length === 1) {
        const member = selectedMembers[0];
        try {
          const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
          console.log('[LogsPage] Attempting to set map center to:', position, 'Current center:', map.current.getCenter());
          
          // 위도 좌표를 직접 조정하여 200px 아래쪽으로 이동 (대략 0.002도 차이)
                  // 날짜 변경 시에는 시작지점 기준 지도 조정을 우선하므로 멤버 위치 기준 조정은 건너뜀
        // isDateChangedRef.current가 true인 경우도 건너뜀 (날짜 변경 진행 중)
        if (!isDateChange && !isDateChangedRef.current) {
          const latOffset = -0.002; // 200px 아래쪽에 해당하는 위도 오프셋
          const adjustedPosition = new window.naver.maps.LatLng(
            member.location.lat + latOffset, 
            member.location.lng
          );
          
          map.current.setCenter(adjustedPosition);
          
          // 첫 멤버 선택일 때만 줌 설정, 그 외에는 중심만 이동
          if (!firstMemberSelected) {
            map.current.setZoom(16);
            setFirstMemberSelected(true);
            console.log('[LogsPage] 줌 레벨 설정: 16 (첫 멤버 선택)');
          } else {
            console.log('[LogsPage] 멤버 재선택 - 중심만 이동, 줌 유지');
          }
          
          map.current.refresh(true); 
          console.log('[LogsPage] Map center set 200px below member location:', member.name, 'Original:', member.location, 'Adjusted:', adjustedPosition);
        } else {
          console.log('[LogsPage] 날짜 변경 시 - 시작지점 기준 지도 조정을 위해 멤버 위치 기준 조정 건너뜀');
        }
        
        // 날짜 변경 플래그 리셋
        if (isDateChange) {
          isDateChangedRef.current = false;
          setPreviousDate(selectedDate);
          console.log('[LogsPage] 날짜 변경 플래그 리셋 완료');
        }
          
          // 잠시 후 최종 중심점 확인
          setTimeout(() => {
            if (map.current) {
              console.log('[LogsPage] Final center after 500ms:', map.current.getCenter());
            }
          }, 500);
        } catch (error) {
          console.error('[LogsPage] Error setting map center:', error);
        }
      }
    }
  };

  // 지도 마커와 경로 즉시 초기화 함수
  const clearMapMarkersAndPaths = () => {
    console.log('[clearMapMarkersAndPaths] 지도 마커와 경로 즉시 초기화');
    
    // 위치 로그 마커들 정리
    locationLogMarkers.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    locationLogMarkers.current = [];
    
    // 경로 폴리라인 정리
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
    
    // 상태 데이터도 즉시 초기화
    setCurrentLocationLogs([]);
    setDailySummaryData([]);
    setStayTimesData([]);
    setMapMarkersData([]);
    setLocationLogSummaryData(null);
    setLocationSummary(DEFAULT_LOCATION_SUMMARY);
  };

  const handleDateSelect = (date: string) => {
    console.log('[LOGS] 날짜 선택:', date, '이전 날짜:', selectedDate);
    
    // 같은 날짜를 재선택한 경우 무시
    const isDateActuallyChanging = selectedDate !== date;
    if (!isDateActuallyChanging) {
      console.log('[LOGS] 같은 날짜 재선택 - 무시');
      return;
    }
    
    // 날짜 변경 시 즉시 지도 초기화
    clearMapMarkersAndPaths();
    
    // 이전 날짜 저장 후 새 날짜 설정
    setPreviousDate(selectedDate);
    setSelectedDate(date);
    setActiveLogView('members');
    
    // 날짜가 실제로 변경되는 경우 firstMemberSelected 상태 리셋
    setFirstMemberSelected(false);
    isDateChangedRef.current = true; // 날짜 변경 플래그 설정
    console.log('[LOGS] 날짜 변경으로 firstMemberSelected 리셋 및 날짜 변경 플래그 설정');
    
    // 날짜 변경 시 멤버 활동 데이터 다시 조회
    if (selectedGroupId) {
      console.log('[LOGS] 날짜 변경 - 멤버 활동 데이터 재조회:', date);
      loadMemberActivityByDate(selectedGroupId, date);
    }
    
    // 선택된 멤버가 있으면 데이터 로딩 (시작지점 기준 지도 조정은 데이터 로드 후 처리)
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember) {
      console.log('[LOGS] 날짜 변경 - 선택된 멤버의 위치 데이터 로딩:', selectedMember.name, date);
      loadLocationData(parseInt(selectedMember.id), date);
    } else {
      console.log('[LOGS] 날짜 변경 - 선택된 멤버가 없음, 데이터 로딩 안함');
    }
  };

  // 위치 로그 데이터 로딩 함수 (새로운 3개 API 포함)
  const loadLocationData = async (mtIdx: number, date: string) => {
    if (!mtIdx || !date) {
      console.log('[loadLocationData] mtIdx 또는 date가 없어서 실행하지 않음:', { mtIdx, date });
      return;
    }

    // 중복 실행 방지 (더 강화)
    const executionKey = `${mtIdx}-${date}`;
    const currentTime = Date.now();
    
    // 같은 요청이 3초 이내에 들어오면 무시
    if (loadLocationDataExecutingRef.current.executing) {
      console.log(`[loadLocationData] 이미 실행 중이므로 건너뜀: ${executionKey}`);
      return;
    }
    
    if (loadLocationDataExecutingRef.current.lastExecution && 
        (currentTime - loadLocationDataExecutingRef.current.lastExecution) < 3000) {
      console.log(`[loadLocationData] 3초 이내 중복 요청 무시: ${executionKey}`);
      return;
    }
    
    loadLocationDataExecutingRef.current.executing = true;
    loadLocationDataExecutingRef.current.lastExecution = currentTime;
    console.log(`[loadLocationData] 실행 시작: ${executionKey}-${currentTime}`);

    try {
      setIsLocationDataLoading(true);
      console.log('[loadLocationData] 위치 데이터 로딩 시작:', { mtIdx, date });

      // 새로운 날짜 데이터 로드 전에 기존 마커들 모두 정리
      console.log('[loadLocationData] 기존 마커들 정리 시작');
      
      // 위치 로그 마커들 정리
      locationLogMarkers.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      locationLogMarkers.current = [];
      
      // 경로 폴리라인 정리
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
      
      console.log('[loadLocationData] 기존 마커들 정리 완료');

      // 모든 API를 병렬로 호출 (PHP 로직 기반 요약 API 추가)
      const [logs, summary, dailySummary, stayTimes, mapMarkers, locationLogSummary] = await Promise.all([
        memberLocationLogService.getDailyLocationLogs(mtIdx, date),
        memberLocationLogService.getDailyLocationSummary(mtIdx, date),
        memberLocationLogService.getDailySummaryByRange(mtIdx, date, date),
        memberLocationLogService.getStayTimes(mtIdx, date),
        memberLocationLogService.getMapMarkers(mtIdx, date),
        memberLocationLogService.getLocationLogSummary(mtIdx, date) // PHP 로직 기반 요약 API
      ]);

      // 기존 위치 로그 데이터 설정
      setCurrentLocationLogs(logs);
      console.log('[loadLocationData] 위치 로그 데이터 로딩 완료:', logs.length, '개');

      // 기존 요약 정보를 UI 형식으로 변환
      const formattedSummary: LocationSummary = {
        distance: summary.total_distance ? `${(summary.total_distance / 1000).toFixed(1)} km` : '0 km',
        time: summary.total_time ? formatTime(parseInt(summary.total_time.toString())) : '0분',
                  steps: summary.step_count ? `${Number(summary.step_count).toLocaleString()} 걸음` : '0 걸음'
      };
      
      setLocationSummary(formattedSummary);
      console.log('[loadLocationData] 위치 요약 데이터 로딩 완료:', formattedSummary);

      // 새로운 API 응답 데이터 설정
      setDailySummaryData(dailySummary);
      setStayTimesData(stayTimes);
      setMapMarkersData(mapMarkers);
      setLocationLogSummaryData(locationLogSummary); // PHP 로직 기반 요약 데이터 설정
      
      console.log('[loadLocationData] 날짜별 요약 데이터 로딩 완료:', dailySummary.length, '일');
      console.log('[loadLocationData] 체류시간 분석 데이터 로딩 완료:', stayTimes.length, '개');
      console.log('[loadLocationData] 지도 마커 데이터 로딩 완료:', mapMarkers.length, '개');
      console.log('[loadLocationData] PHP 로직 기반 요약 데이터 로딩 완료:', locationLogSummary);

      // 지도에 위치 경로 표시 (나중에 구현)
      // updateLocationPath(logs);

    } catch (error) {
      console.error('[loadLocationData] 위치 데이터 로딩 오류:', error);
      
      // 오류 시 기본값으로 설정
      setCurrentLocationLogs([]);
      setLocationSummary(DEFAULT_LOCATION_SUMMARY);
      setDailySummaryData([]);
      setStayTimesData([]);
      setMapMarkersData([]);
      setLocationLogSummaryData(null);
    } finally {
      setIsLocationDataLoading(false);
      loadLocationDataExecutingRef.current.executing = false;
      console.log(`[loadLocationData] 실행 완료: ${executionKey}-${currentTime}`);
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
      console.log('  - 멤버별 상세 데이터:');
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
      console.log('[LOGS] 일별 위치 기록 카운트 조회 완료:', response);
    } catch (error) {
      console.error('[LOGS] 일별 위치 기록 카운트 조회 실패:', error);
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
      setMemberActivityData(null);
    } finally {
      setIsMemberActivityLoading(false);
    }
  };

  // 새로운 API 데이터가 변경될 때마다 콘솔에 출력
  useEffect(() => {
    if (dailySummaryData.length > 0 || stayTimesData.length > 0 || mapMarkersData.length > 0 || locationLogSummaryData || dailyCountsData || memberActivityData) {
      logNewApiData();
    }
  }, [dailySummaryData, stayTimesData, mapMarkersData, locationLogSummaryData, dailyCountsData, memberActivityData]);

  // 지도 마커 데이터가 변경될 때마다 지도에 마커 업데이트
  useEffect(() => {
    console.log('[LOGS] 마커 데이터 변경 감지:', {
      isMapInitializedLogs,
      mapMarkersDataLength: mapMarkersData.length,
      mapMarkersData: mapMarkersData.slice(0, 2) // 첫 2개만 로그
    });
    
    if (isMapInitializedLogs) {
      console.log('[LOGS] 지도에 마커 업데이트 실행:', mapMarkersData.length, '개');
      updateLocationLogMarkers(mapMarkersData);
      
      // 첫 번째 마커(시작지점)를 기준으로 지도 중심 조정
      if (map.current && mapMarkersData.length > 0) {
        const firstMarker = mapMarkersData[0];
        const lat = firstMarker.latitude || firstMarker.mlt_lat || 0;
        const lng = firstMarker.longitude || firstMarker.mlt_long || 0;
        
        if (lat !== 0 && lng !== 0) {
          const latOffset = -0.002; // 아래쪽 오프셋
          const adjustedPosition = new window.naver.maps.LatLng(lat + latOffset, lng);
          
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
      }
    } else {
      console.log('[LOGS] 지도가 초기화되지 않아서 마커 업데이트 건너뜀');
    }
  }, [mapMarkersData, isMapInitializedLogs]);

  // 체류시간 데이터가 변경될 때마다 지도에 체류시간 마커 업데이트
  // (이제 updateLocationLogMarkers 내에서 호출되므로 별도 useEffect 불필요)
  // useEffect(() => {
  //   if (isMapInitializedLogs && stayTimesData.length > 0) {
  //     console.log('[LOGS] 체류시간 데이터 변경 감지 - 지도에 체류시간 마커 업데이트:', stayTimesData.length, '개');
  //     updateStayTimeMarkers(stayTimesData);
  //   }
  // }, [stayTimesData, isMapInitializedLogs]);

  // useEffect for auto-selecting the first member and updating map based on selection
  useEffect(() => {
    if (isMapInitializedLogs && groupMembers.length > 0) {
      // 첫 번째 멤버 자동 선택 (선택된 멤버가 없는 경우)
      if (!groupMembers.some(m => m.isSelected)) {
      console.log("[LogsPage] Auto-selection: Setting first member as selected.");
      const updatedMembers = groupMembers.map((member, index) => ({
        ...member,
        isSelected: index === 0,
      }));
      setGroupMembers(updatedMembers);
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
      updateMemberMarkers(groupMembers, isDateChange);
      setActiveLogView('members'); // 멤버 선택/지도 업데이트 시 members 뷰 활성화
      
      // 선택된 멤버의 위치 데이터 로드 (기존 데이터가 없거나 날짜 변경된 경우에만)
      const selectedMember = groupMembers.find(m => m.isSelected);
      if (selectedMember && selectedDate) {
        // 기존 로그 데이터가 있고 날짜 변경이 아닌 경우 재조회 안함
        const hasExistingData = mapMarkersData.length > 0 || currentLocationLogs.length > 0;
        const isDateChangeCase = isDateChangedRef.current;
        
        if (!hasExistingData || isDateChangeCase) {
          console.log("[LogsPage] 선택된 멤버의 위치 데이터 로드:", selectedMember.name, selectedDate, { hasExistingData, isDateChangeCase });
          // loadLocationData에서 중복 실행 방지가 적용됨
          loadLocationData(parseInt(selectedMember.id), selectedDate);
        } else {
          console.log("[LogsPage] 기존 로그 데이터 유지 - 재조회하지 않음:", selectedMember.name, selectedDate);
        }
      }
    }
  }, [groupMembers, isMapInitializedLogs]); // selectedDate 제거 - 날짜 변경 시 지도 조정 중복 방지

  // 로그 뷰 스크롤 이벤트 핸들러
  const handleLogSwipeScroll = () => {
    if (logSwipeContainerRef.current) {
      const container = logSwipeContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.offsetWidth;
      const threshold = containerWidth * 0.3; // 30% 이상 스와이프하면 전환

      const newView = scrollLeft < threshold ? 'members' : 'summary';
      if (activeLogView !== newView) {
        setActiveLogView(newView);
        console.log('[LOG_SWIPE] 뷰 변경:', activeLogView, '→', newView, '(무조건 완료)');
        
        // 즉시 끝까지 스크롤하여 완료
        setTimeout(() => {
          if (logSwipeContainerRef.current) {
            if (newView === 'members') {
              logSwipeContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
              const secondChild = logSwipeContainerRef.current.children[1] as HTMLElement;
              if (secondChild) {
                logSwipeContainerRef.current.scrollTo({ left: secondChild.offsetLeft, behavior: 'smooth' });
              }
            }
          }
        }, 50);
      }
    }
  };

  // activeLogView 변경 시 스크롤 위치 조정
  useEffect(() => {
    if (logSwipeContainerRef.current) {
      if (activeLogView === 'members') {
        logSwipeContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const secondChild = logSwipeContainerRef.current.children[1] as HTMLElement;
        if (secondChild) {
          logSwipeContainerRef.current.scrollTo({ left: secondChild.offsetLeft, behavior: 'smooth' });
        }
      }
    }
  }, [activeLogView]);

  // 날짜 스크롤 자동 조정 함수
  const scrollToTodayDate = (reason?: string) => {
    if (dateScrollContainerRef.current) {
      const container = dateScrollContainerRef.current;
      // 즉시 스크롤을 맨 오른쪽으로 이동 (오늘 날짜 보이게)
      container.scrollLeft = container.scrollWidth;
      console.log('[날짜 스크롤] 오늘 날짜로 이동 완료', reason ? `(${reason})` : '');
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
          const memberData = await memberService.getGroupMembers(groupIdToUse);
          if (isMounted) { 
            if (memberData && memberData.length > 0) { 
              currentMembers = memberData.map((member: any, index: number) => ({
                id: member.mt_idx.toString(),
                name: member.mt_name || `멤버 ${index + 1}`,
                photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
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
              }));
            } else {
              console.warn('No member data from API, or API call failed.');
            }
            setGroupMembers(currentMembers); 
            dataFetchedRef.current.members = true;

            // 그룹 멤버 조회 완료 후 날짜별 활동 로그 관련 API 호출
            console.log('[LOGS] 그룹 멤버 조회 완료 - 날짜별 활동 로그 API 호출 시작');
            
            // 1. 최근 14일간 일별 카운트 조회
            if (isMounted) {
              await loadDailyLocationCounts(selectedGroupId, 14);
            }
            
            // 2. 현재 선택된 날짜의 멤버 활동 조회
            if (isMounted && selectedDate) {
              await loadMemberActivityByDate(selectedGroupId, selectedDate);
            }
            
            console.log('[LOGS] 날짜별 활동 로그 API 호출 완료');
          }
        }


      } catch (error) {
        console.error('[LOGS PAGE] 그룹 데이터(멤버 또는 스케줄) 조회 오류:', error);
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
    
    // 그룹 변경 시 즉시 지도 초기화
    clearMapMarkersAndPaths();
    console.log(`[${instanceId.current}] 그룹 변경으로 지도 초기화 완료`);
    
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 기존 데이터 초기화
    setGroupMembers([]);
    setFirstMemberSelected(false);
    dataFetchedRef.current = { members: false };
    fetchDataExecutingRef.current = false;
    hasExecuted.current = false; // 실행 플래그도 리셋
    loadLocationDataExecutingRef.current.executing = false; // loadLocationData 실행 플래그도 리셋
    firstMemberSelectExecutingRef.current = false; // 첫 멤버 선택 실행 플래그도 리셋
    
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



  // 첫번째 멤버 자동 선택 및 위치 데이터 로딩 - 메인 인스턴스에서만
  const firstMemberSelectExecutingRef = useRef(false);
  useEffect(() => {
    if (!isMainInstance.current) {
      console.log(`[${instanceId.current}] 서브 인스턴스 - 첫번째 멤버 자동 선택 건너뜀`);
      return;
    }

    if (groupMembers.length > 0 && 
        !groupMembers.some(m => m.isSelected) && 
        !firstMemberSelected && 
        dataFetchedRef.current.members && 
        selectedDate &&
        !firstMemberSelectExecutingRef.current) {
      
      console.log(`[${instanceId.current}] 첫번째 멤버 자동 선택 시작:`, groupMembers[0].name, '선택된 날짜:', selectedDate);
      
      firstMemberSelectExecutingRef.current = true;
      setFirstMemberSelected(true);
      
      setTimeout(() => {
        console.log(`[${instanceId.current}] 첫번째 멤버 자동 선택 실행:`, groupMembers[0].id);
        handleMemberSelect(groupMembers[0].id, {} as React.MouseEvent);
        
        // 첫 번째 멤버의 위치 데이터는 useEffect에서 멤버 선택 감지로 자동 로딩됨
        console.log(`[${instanceId.current}] 첫번째 멤버 선택 완료, 위치 데이터는 useEffect에서 처리됨`);
        
        firstMemberSelectExecutingRef.current = false;
      }, 500);
    }
  }, [groupMembers, firstMemberSelected, selectedDate]);

  return (
    <>
      <style jsx global>{pageStyles}</style>
      
      {/* 메인 컨테이너 */}
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        className="bg-gradient-to-br from-purple-50 via-white to-pink-50 min-h-screen relative overflow-hidden"
      >
        {/* 통합 헤더 - 내용만 변경됨 */}
        {!(isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) && (
          <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1 
            }}
            className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-purple-50/90 via-white/95 to-pink-50/90 backdrop-blur-sm border-b border-purple-100/50 h-16"
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
                  <motion.div
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className="p-2 bg-indigo-600 rounded-xl"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-white stroke-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </motion.div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">활동 로그</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들의 활동 기록을 확인해보세요</p>
                  </div>
                </div>
              </div>
              </motion.div>
            )}

                        {/* 날짜 선택 내용 */}
            {showDateSelection && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full px-4 flex flex-col justify-center"
              >
                <motion.div 
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <motion.div
                    initial={{ rotate: 0, scale: 0 }}
                    animate={{ rotate: 360, scale: 1 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: 0.2,
                      type: "spring",
                      stiffness: 200
                    }}
                  >
                    <FiClock className="w-4 h-4 text-purple-600" />
                  </motion.div>
                  <h3 className="text-base font-bold text-gray-900">날짜 선택</h3>
                  <motion.div 
                    className="text-xs text-gray-500"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: 0.3,
                      type: "spring",
                      stiffness: 150
                    }}
                  >
                    {(() => {
                      const selectedMember = groupMembers.find(m => m.isSelected);
                      const recentDays = getRecentDays();
                      const daysWithLogs = recentDays.filter(day => day.hasLogs).length;
                      
                      return `(${daysWithLogs}일 기록 있음)`;
                      
                    })()}
                  </motion.div>
                </motion.div>
                <motion.div 
                  ref={dateScrollContainerRef} 
                  className="flex space-x-2 overflow-x-auto hide-scrollbar"
                  style={{ scrollBehavior: 'auto' }}
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {getRecentDays().map((day, idx) => {
                    const isSelected = selectedDate === day.value;
                    const isToday = idx === getRecentDays().length - 1; // 오늘인지 확인

                    return (
                      <motion.button 
                        key={idx} 
                        custom={idx}
                        variants={{
                          initial: { opacity: 0, y: 10 },
                          animate: { 
                            opacity: 1, 
                            y: 0,
                            transition: { duration: 0.3, delay: 0.4 + (idx * 0.02) }
                          },
                          hover: { 
                            y: day.hasLogs || isSelected ? -2 : 0,
                            boxShadow: day.hasLogs || isSelected ? "0 3px 6px rgba(0,0,0,0.1)" : "0 1px 2px rgba(0,0,0,0.1)",
                            transition: { duration: 0.2 }
                          },
                          tap: { 
                            y: -1,
                            transition: { duration: 0.1 }
                          }
                        }}
                        initial="initial"
                        animate="animate"
                        whileHover="hover"
                        whileTap="tap"
                        onClick={() => day.hasLogs && handleDateSelect(day.value)}
                        disabled={!day.hasLogs && !isSelected}
                        className={`px-2.5 py-1 rounded-lg flex-shrink-0 focus:outline-none text-xs min-w-[65px] h-7 flex flex-col justify-center items-center border transition-all duration-300 ${
                          isSelected
                            ? `bg-purple-600 text-white font-semibold shadow-md border-purple-600 ${!day.hasLogs ? 'opacity-70' : ''}`
                            : day.hasLogs
                            ? 'bg-white text-gray-700 hover:bg-purple-50 hover:border-purple-300 border-gray-200 font-medium shadow-sm'
                            : 'bg-gray-50 text-gray-400 line-through cursor-not-allowed border-gray-100 font-medium'
                        }`}
                      >
                        <motion.div 
                          className="text-center text-xs whitespace-nowrap font-medium"
                          animate={isSelected ? {
                            opacity: [0.8, 1, 0.8],
                            transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                          } : {}}
                        >
                          {day.display}
                        </motion.div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </motion.header>
        )}
        
        {/* 전체화면 로딩 - 체크리스트 형태 */}
        {(isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) && (
          <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
            <div className="text-center max-w-sm mx-auto px-6">
              {/* 상단 로고 및 제목 */}
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">활동 로그를 준비하고 있습니다</h2>
                <p className="text-sm text-gray-600">잠시만 기다려주세요...</p>
              </div>

              {/* 로딩 체크리스트 - 컴팩트 버전 */}
              <div className="space-y-1">
                {/* 1. 지도 로딩 */}
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    !isMapLoading 
                      ? 'bg-green-500 border-green-500 scale-110' 
                      : 'border-indigo-300 animate-pulse'
                  }`}>
                    {!isMapLoading ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                    )}
                  </div>
                  <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                    !isMapLoading ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    지도 불러오기
                  </span>
                </div>

                {/* 2. 지도 초기화 */}
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    !isMapLoading && isMapInitializedLogs 
                      ? 'bg-green-500 border-green-500 scale-110' 
                      : isMapLoading 
                        ? 'border-gray-300' 
                        : 'border-purple-300 animate-pulse'
                  }`}>
                    {!isMapLoading && isMapInitializedLogs ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : !isMapLoading ? (
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                    ) : (
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    )}
                  </div>
                  <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                    !isMapLoading && isMapInitializedLogs ? 'text-green-700' : isMapLoading ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    지도 초기화
                  </span>
                </div>

                {/* 3. 활동 데이터 로딩 */}
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    !isMapLoading && isMapInitializedLogs && isInitialDataLoaded 
                      ? 'bg-green-500 border-green-500 scale-110' 
                      : (!isMapLoading && isMapInitializedLogs)
                        ? 'border-purple-300 animate-pulse'
                        : 'border-gray-300'
                  }`}>
                    {!isMapLoading && isMapInitializedLogs && isInitialDataLoaded ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (!isMapLoading && isMapInitializedLogs) ? (
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                    ) : (
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    )}
                  </div>
                  <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                    !isMapLoading && isMapInitializedLogs && isInitialDataLoaded ? 'text-green-700' : (!isMapLoading && isMapInitializedLogs) ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    활동 데이터 불러오기
                  </span>
                </div>
              </div>

              {/* 진행률 표시 */}
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${
                        (!isMapLoading ? 33 : 0) +
                        (!isMapLoading && isMapInitializedLogs ? 34 : 0) +
                        (!isMapLoading && isMapInitializedLogs && isInitialDataLoaded ? 33 : 0)
                      }%`
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {(!isMapLoading ? 1 : 0) +
                   (!isMapLoading && isMapInitializedLogs ? 1 : 0) +
                   (!isMapLoading && isMapInitializedLogs && isInitialDataLoaded ? 1 : 0)}/3 단계 완료
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 지도 영역 */}
        <div 
          className="full-map-container" 
          style={{ 
            paddingTop: '0px', // 지도 영역을 화면 전체로 확장
            position: 'relative' // 로딩 오버레이를 위한 relative 포지션
          }}
        >
          <div ref={mapContainer} className="w-full h-full" />
          
          {/* 지도 로딩 오버레이 */}
          {(isLocationDataLoading || isDailyCountsLoading || isMemberActivityLoading) && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40">
              <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center space-y-4 max-w-xs mx-4">
                {/* 스피너 */}
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                </div>
                
                {/* 로딩 텍스트 */}
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    {isLocationDataLoading ? '위치 데이터 로딩 중...' :
                     isDailyCountsLoading ? '일별 카운트 조회 중...' :
                     isMemberActivityLoading ? '멤버 활동 조회 중...' : '데이터 로딩 중...'}
                  </p>
                  <p className="text-sm text-gray-600">
                    잠시만 기다려주세요
                  </p>
                </div>
                
                {/* 진행 표시 점들 */}
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sheet - home/page.tsx와 동일한 framer-motion 적용 */}
        {!(isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) && (
          <motion.div 
            ref={bottomSheetRef}
            initial={{ translateY: '100%' }}
            variants={bottomSheetVariants}
            animate={bottomSheetState}
            className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
            style={{ touchAction: isHorizontalSwipeRef.current === true ? 'pan-x' : 'pan-y' }}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            {/* 바텀시트 핸들 - home/page.tsx와 동일한 스타일 */}
            <motion.div 
              className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-3 cursor-grab active:cursor-grabbing"
              whileHover={{ scale: 1.05, backgroundColor: '#6366f1' }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />

            {/* 바텀시트 내용 - 스크롤 가능하도록 수정 */}
            <div className="px-6 pb-2 overflow-y-auto max-h-full">
              <div 
                ref={logSwipeContainerRef}
                className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar mb-2 gap-2 bg-white"
                style={{
                  minHeight: '200px',
                  overflowY: 'visible',
                  overscrollBehavior: 'none',
                  WebkitOverflowScrolling: 'auto'
                }}
                onScroll={handleLogSwipeScroll}
                onTouchEnd={handleLogSwipeScroll}
                onMouseUp={handleLogSwipeScroll}
              >
                <div className="w-full flex-shrink-0 snap-start overflow-visible bg-white">
                  <div 
                    className="content-section members-section rounded-2xl p-4 border border-indigo-100 h-[200px] overflow-y-auto hide-scrollbar"
                    style={{
                      background: 'linear-gradient(to right, #eef2ff, #faf5ff) !important',
                      backgroundImage: 'linear-gradient(to right, #eef2ff, #faf5ff) !important'
                    }}
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="hide-scrollbar flex-1"
                    >
                                              <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <FiUser className="w-5 h-5 text-indigo-600" />
                              <div>
                                <h2 className="text-lg font-bold text-gray-900">그룹 멤버</h2>
                                <p className="text-sm text-gray-600">멤버들의 로그를 확인하세요</p>
                              </div>
                            </div>
                          {(isUserDataLoading || !dataFetchedRef.current.members) && (
                            <motion.div
                              variants={spinnerVariants}
                              animate="animate"
                            >
                              <FiLoader className="text-indigo-500" size={18}/>
                            </motion.div>
                          )}
                              </div>
                        
                        <div className="flex items-center space-x-3">
                          {/* 그룹 선택 드롭다운 */}
                          <div className="relative" ref={groupDropdownRef}>
                            <motion.button
                              whileHover={{ 
                                scale: 1.02, 
                                y: -2,
                                borderColor: "#6366f1",
                                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.15)",
                                transition: { duration: 0.2, ease: "easeOut" }
                              }}
                              whileTap={{ 
                                scale: 0.98,
                                transition: { duration: 0.1, ease: "easeInOut" }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('[그룹 드롭다운] 버튼 클릭, 현재 상태:', isGroupSelectorOpen);
                                setIsGroupSelectorOpen(!isGroupSelectorOpen);
                              }}
                              className="group-selector flex items-center justify-between px-4 py-2 rounded-xl text-sm font-medium min-w-[140px] mobile-button"
                              disabled={isUserDataLoading}
                              data-group-selector="true"
                            >
                              <span className="truncate text-gray-700">
                                {isUserDataLoading 
                                  ? '로딩 중...' 
                                  : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                                }
                              </span>
                              <div className="ml-2 flex-shrink-0">
                                {isUserDataLoading ? (
                                  <motion.div
                                    variants={spinnerVariants}
                                    animate="animate"
                                  >
                                    <FiLoader className="text-gray-400" size={14} />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                  >
                                    <FiChevronDown className="text-gray-400" size={14} />
                                  </motion.div>
                                )}
                          </div>
                            </motion.button>

                            {/* 그룹 선택 드롭다운 메뉴 */}
                            {isGroupSelectorOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute top-full mt-2 right-0 z-50 min-w-[200px] bg-white border border-indigo-200 rounded-xl shadow-xl overflow-hidden"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <div className="py-2">
                                  {isUserDataLoading ? (
                                    <div className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center space-x-2">
                                        <motion.div
                                          variants={spinnerVariants}
                                          animate="animate"
                                        >
                                          <FiLoader className="text-indigo-500" size={16} />
                                        </motion.div>
                                        <span className="text-sm text-gray-600">로딩 중...</span>
                      </div>
                                    </div>
                                  ) : userGroups.length > 0 ? (
                                    userGroups.map((group) => (
                                      <motion.button
                                        key={group.sgt_idx}
                                        whileHover={{ backgroundColor: '#f8fafc' }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log('[그룹 드롭다운] 그룹 선택:', group.sgt_title);
                                          
                                          if (selectedGroupId === group.sgt_idx) {
                                            console.log('[그룹 드롭다운] 현재 선택된 그룹 재클릭 - 드롭다운 닫기');
                                            setIsGroupSelectorOpen(false);
                                            return;
                                          }
                                          
                                          handleGroupSelect(group.sgt_idx);
                                        }}
                                        className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors duration-150 flex items-center justify-between ${
                                          selectedGroupId === group.sgt_idx
                                            ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex-1">
                                          <div className="font-semibold truncate">{group.sgt_title}</div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            멤버 {groupMemberCounts[group.sgt_idx] || 0}명
                                          </div>
                                        </div>
                                        {selectedGroupId === group.sgt_idx && (
                                          <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </motion.button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-6 text-center">
                                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                                        <FiUser className="w-6 h-6 text-gray-400" />
                                      </div>
                                      <p className="text-sm text-gray-600 font-medium">참여한 그룹이 없습니다</p>
                                      <p className="text-xs text-gray-500 mt-1">새로운 그룹을 만들어보세요</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 멤버 목록 내용 */}
                      {(isUserDataLoading || !dataFetchedRef.current.members) ? (
                        <motion.div 
                          variants={loadingVariants}
                          initial="hidden"
                          animate="visible"
                          className="flex flex-col items-center justify-center py-8"
                        >
                          <div className="relative flex items-center justify-center mb-4">
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                className="absolute w-12 h-12 border border-indigo-200 rounded-full"
                                animate={{
                                  scale: [1, 1.8, 1],
                                  opacity: [0.4, 0, 0.4],
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  delay: i * 0.4,
                                  ease: [0.22, 1, 0.36, 1]
                                }}
                              />
                            ))}
                            
                            <motion.div
                              className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                              style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                              }}
                              variants={spinnerVariants}
                              animate="animate"
                            >
                              <FiUser className="w-6 h-6 text-white" />
                            </motion.div>
                              </div>
                          
                          <motion.div
                            variants={loadingTextVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <p className="font-medium text-gray-900 mb-1">멤버 정보를 불러오는 중...</p>
                            <p className="text-sm text-gray-600">잠시만 기다려주세요</p>
                          </motion.div>
                        </motion.div>
                      ) : groupMembers.length > 0 ? (
                        <motion.div 
                          variants={staggerContainer}
                          initial="hidden"
                          animate="visible"
                          className="flex flex-row flex-nowrap justify-start items-center gap-x-6 overflow-x-auto hide-scrollbar px-2 py-2"
                        >
                          {(() => {
                            const hasSelectedMember = groupMembers.some(member => member.isSelected);
                            if (!hasSelectedMember && groupMembers.length > 0 && dataFetchedRef.current.members) {
                              console.log('[멤버 렌더링] 선택된 멤버가 없음, 첫 번째 멤버 자동 선택:', groupMembers[0].name);
                              setTimeout(() => {
                                handleMemberSelect(groupMembers[0].id, {} as React.MouseEvent);
                              }, 50);
                            }
                            return null;
                          })()}
                          {groupMembers.map((member, index) => {
                        return (
                              <motion.div 
                                key={member.id} 
                                custom={index}
                                variants={memberAvatarVariants}
                                initial="initial"
                                animate="animate"
                                whileHover="hover"
                                className="flex flex-col items-center p-0 flex-shrink-0"
                              >
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMemberSelect(member.id, e);
                                  }}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onTouchMove={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => e.stopPropagation()}
                                  className="flex flex-col items-center focus:outline-none mobile-button"
                                  animate={member.isSelected ? "selected" : "animate"}
                                >
                                  <motion.div
                                    className={`member-avatar w-13 h-13 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ${
                                      member.isSelected ? 'selected' : ''
                                    }`}
                                    animate={member.isSelected ? "selected" : undefined}
                                  >
                                    <img 
                                      src={getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}
                                      alt={member.name} 
                                      className="w-full h-full object-cover rounded-xl" 
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const defaultImg = getDefaultImage(member.mt_gender, member.original_index);
                                        console.log(`[이미지 오류] ${member.name}의 이미지 로딩 실패, 기본 이미지로 대체:`, defaultImg);
                                        target.src = defaultImg;
                                        target.onerror = null;
                                      }}
                                    />
                                  </motion.div>
                                  <span className={`block text-sm font-semibold mt-3 transition-colors duration-200 ${
                                    member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                                  }`}>
                                {member.name}
                              </span>
                                </motion.button>
                              </motion.div>
                        );
                      })}
                        </motion.div>
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center"
                          >
                            <FiUser className="w-8 h-8 text-gray-300" />
                          </motion.div>
                          <p className="font-medium">그룹에 참여한 멤버가 없습니다</p>
                          <p className="text-sm mt-1">그룹에 멤버를 초대해보세요</p>
                    </div>
                      )}
                    </motion.div>
                  </div>


                </div>

                <div className="w-full flex-shrink-0 snap-start overflow-hidden bg-white to-rose-50">
                  <div 
                    className="content-section summary-section min-h-[200px] max-h-[200px] overflow-y-auto flex flex-col bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4"
                  >
                    <div>
                      <h2 className="text-lg font-medium text-gray-900 flex justify-between items-center section-title mb-2">
                        {groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 위치기록 요약` : "위치기록 요약"}
                      </h2>
                      <div className="mb-2 px-1 flex items-center">
                        <FiPlayCircle className="w-6 h-6 text-amber-500 mr-2" />
                        <h4 className="text-sm font-medium text-gray-700">경로 따라가기</h4>
                      </div>
                      <div className="px-2 pt-2 mb-6">
                        <div className="relative w-full h-1.5 bg-gray-200 rounded-full">
                          <div 
                            className="absolute top-0 left-0 h-1.5 bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${sliderValue}%` }} 
                          ></div>
                          <div 
                            className="absolute top-1/2 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white shadow transform -translate-y-1/2 transition-all duration-300 ease-out"
                            style={{ left: `calc(${sliderValue}% - 8px)` }}
                          ></div>
                        </div>
                      </div>
                      {isLocationDataLoading ? (
                        <div className="flex justify-center items-center py-4">
                          <div className="flex items-center space-x-2">
                            <FiLoader className="w-5 h-5 text-indigo-600 animate-spin" />
                            <span className="text-sm text-gray-600">위치 데이터를 불러오는 중...</span>
                          </div>
                        </div>
                      ) : (
                      <div className="flex justify-around text-center px-1">
                        <div className="flex flex-col items-center">
                          <FiTrendingUp className="w-6 h-6 text-amber-500 mb-1" />
                          <p className="text-xs text-gray-500">이동거리</p>
                          <p className="text-sm font-semibold text-gray-700 mt-0.5">{locationSummary.distance}</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <FiClock className="w-6 h-6 text-amber-500 mb-1" />
                          <p className="text-xs text-gray-500">이동시간</p>
                          <p className="text-sm font-semibold text-gray-700 mt-0.5">{locationSummary.time}</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <FiZap className="w-6 h-6 text-amber-500 mb-1" />
                          <p className="text-xs text-gray-500">걸음 수</p>
                          <p className="text-sm font-semibold text-gray-700 mt-0.5">{locationSummary.steps}</p>
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 점 인디케이터 - 섹션과 네비게이션 바 사이 중앙 고정 */}
              <div className="flex-shrink-0 pt-2 pb-6 bg-white -mt-7">
                <div className="flex justify-center items-center space-x-2 mb-2">
                  <motion.div
                    className={`rounded-full transition-all duration-300 ${
                      activeLogView === 'members' ? 'bg-indigo-600 w-6 h-2' : 'bg-gray-300 w-2 h-2'
                    }`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.div
                    className={`rounded-full transition-all duration-300 ${
                      activeLogView === 'summary' ? 'bg-pink-600 w-6 h-2' : 'bg-gray-300 w-2 h-2'
                    }`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  />
                </div>

                {/* 스와이프 힌트 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ delay: 0.8 }}
                  className="text-center"
                >
                  <span className="text-xs text-gray-400 font-medium">← 좌우로 스와이프 →</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
} 