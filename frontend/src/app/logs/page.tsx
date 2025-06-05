'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
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
import memberLocationLogService, { LocationLog, LocationSummary as APILocationSummary, LocationPathData } from '@/services/memberLocationLogService';

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
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
  background: linear-gradient(135deg, #e0e7ff 0%, #e0f2fe 100%);
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

/* 그룹멤버 섹션 그라디언트 배경 */
.members-section-gradient {
  background: linear-gradient(135deg, #e0e7ff 0%, #e0f2fe 30%, #f0e6ff 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
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
const isUnsafeImageUrl = (url: string | null): boolean => {
  if (!url) return true;
  
  // 알려진 문제가 있는 서버 URL들
  const unsafeHosts = [
    '118.67.130.71:8000',
    // 필요시 다른 문제가 있는 호스트들을 추가
  ];
  
  return unsafeHosts.some(host => url.includes(host));
};

// 안전한 이미지 URL을 반환하는 함수 (home/page.tsx와 동일)
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  if (isUnsafeImageUrl(photoUrl)) {
    return getDefaultImage(gender, index);
  }
  return photoUrl || getDefaultImage(gender, index);
};

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

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); 
  const memberNaverMarkers = useRef<any[]>([]); 
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); 
  const [isMapInitializedLogs, setIsMapInitializedLogs] = useState(false); // Logs 페이지용 지도 초기화 상태
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false); // 초기 데이터 로딩 상태 추가

  // home/page.tsx와 동일한 바텀시트 상태 관리
  const [bottomSheetState, setBottomSheetState] = useState<'hidden' | 'middle' | 'peek'>('peek');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const startDragX = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // 로그 페이지 뷰 상태 및 Ref
  const [activeLogView, setActiveLogView] = useState<'members' | 'summary'>('members');
  const logSwipeContainerRef = useRef<HTMLDivElement>(null);
  const [locationSummary, setLocationSummary] = useState<LocationSummary>(DEFAULT_LOCATION_SUMMARY);
  const [currentLocationLogs, setCurrentLocationLogs] = useState<LocationLog[]>([]);
  const [isLocationDataLoading, setIsLocationDataLoading] = useState(false);
  const [sliderValue, setSliderValue] = useState(60); // 슬라이더 초기 값 (0-100)
  const dateScrollContainerRef = useRef<HTMLDivElement>(null); // 날짜 스크롤 컨테이너 Ref 추가

  // home/page.tsx와 동일한 bottomSheetVariants + middle 상태 추가
  const bottomSheetVariants = {
    hidden: { 
      top: '90vh',
      bottom: '0px',
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.6,
        duration: 0.5
      }
    },
    middle: {
      top: '65vh', // 위치기록 요약 섹션 높이(200px)에 맞춤
      bottom: '0px',
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.6,
        duration: 0.5
      }
    },
    peek: {
      top: '48vh',
      bottom: '0px',
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.6,
        duration: 0.5
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
      if (map.current && typeof map.current.destroy === 'function') {
         map.current.destroy();
      }
      map.current = null;
    };
  }, [naverMapsLoaded]);

  const getRecentDays = () => {
    return Array.from({ length: 15 }, (_, i) => { // 오늘부터 14일전까지 (오늘 포함 15일)
      const date = subDays(new Date(), 14 - i);
      const dateString = format(date, 'yyyy-MM-dd');
      const hasLogs = MOCK_LOGS.some(log => log.timestamp.startsWith(dateString));
      
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
      };
    });
  };

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
    
    // 햅틱 피드백 함수
    const triggerHaptic = () => {
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([20, 5, 15]);
        }
      } catch (error) {
        console.debug('햅틱 피드백이 차단되었습니다:', error);
      }
    };

    // 상하 드래그에 대한 바텀시트 상태 변경 (2단계만)
    if (isHorizontalSwipeRef.current === false || isHorizontalSwipeRef.current === null) {
      const startTime = (e.target as any)._startedAt || performance.now() - 200;
      const duration = performance.now() - startTime;
      const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;
      
      const dragThreshold = 50;
      const velocityThreshold = 0.3;
      
      let nextState: 'hidden' | 'middle' | 'peek' = bottomSheetState;
    
      // 위로 드래그 (Y 감소) - 상태 확장
      if (dragDeltaY < 0) {
        if (bottomSheetState === 'hidden' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'middle';
          console.log('[DragEnd] 위로 드래그 감지 (hidden -> middle)');
          triggerHaptic();
        } else if (bottomSheetState === 'middle' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'peek';
          console.log('[DragEnd] 위로 드래그 감지 (middle -> peek)');
          triggerHaptic();
        }
      }
      // 아래로 드래그 (Y 증가) - 상태 축소
      else if (dragDeltaY > 0) {
        if (bottomSheetState === 'peek' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'middle';
          console.log('[DragEnd] 아래로 드래그 감지 (peek -> middle)');
          triggerHaptic();
        } else if (bottomSheetState === 'middle' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'hidden';
          console.log('[DragEnd] 아래로 드래그 감지 (middle -> hidden)');
          triggerHaptic();
        }
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
      const next = prev === 'hidden' ? 'middle' : prev === 'middle' ? 'peek' : 'hidden';
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
    updateMemberMarkers(updatedMembers);
    setActiveLogView('members');
    
    // 바텀시트 상태 유지
    setBottomSheetState(currentBottomSheetState);
    
    // 선택 상태 변경 확인을 위한 로그
    const selectedMember = updatedMembers.find(m => m.isSelected);
    console.log('Selected member:', selectedMember?.name);
    
    // 선택된 멤버의 위치 데이터 로드
    if (selectedMember && selectedDate) {
      loadLocationData(parseInt(selectedMember.id), selectedDate);
    }
  };

  const updateMemberMarkers = (members: GroupMember[]) => {
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

      // 단일 멤버 선택 시 해당 위치로 지도 이동 (중심보다 위쪽으로 20px 오프셋)
      if (selectedMembers.length === 1) {
        const member = selectedMembers[0];
        try {
          const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
          console.log('[LogsPage] Attempting to set map center to:', position, 'Current center:', map.current.getCenter());
          
          // 지도 크기를 가져와서 20px 위쪽 오프셋 계산
          const mapSize = map.current.getSize();
          const offsetPixels = new window.naver.maps.Point(0, -20); // 20px 위쪽으로 오프셋
          const offsetPosition = map.current.getProjection().fromCoordToOffset(position);
          const adjustedOffset = new window.naver.maps.Point(
            offsetPosition.x + offsetPixels.x,
            offsetPosition.y + offsetPixels.y
          );
          const adjustedPosition = map.current.getProjection().fromOffsetToCoord(adjustedOffset);
          
          map.current.setCenter(adjustedPosition);
          map.current.setZoom(14);
          map.current.refresh(true); 
          console.log('[LogsPage] Map center set to member location with offset:', member.name, member.location, 'New center:', map.current.getCenter());
          setTimeout(() => {
            if (map.current) {
              console.log('[LogsPage] Center after 100ms delay (setCenter):', map.current.getCenter());
            }
          }, 100);
        } catch (error) {
          console.error('[LogsPage] Error setting map center:', error);
        }
      }
    }
  };

  const handleDateSelect = (date: string) => {
    console.log('[LOGS] 날짜 선택:', date);
    setSelectedDate(date);
    setActiveLogView('members');
    
    // 선택된 멤버가 있으면 해당 멤버의 위치 데이터를 로드
    const selectedMember = groupMembers.find(m => m.isSelected);
    if (selectedMember) {
      loadLocationData(parseInt(selectedMember.id), date);
    }
  };

  // 위치 로그 데이터 로딩 함수
  const loadLocationData = async (mtIdx: number, date: string) => {
    if (!mtIdx || !date) {
      console.log('[loadLocationData] mtIdx 또는 date가 없어서 실행하지 않음:', { mtIdx, date });
      return;
    }

    try {
      setIsLocationDataLoading(true);
      console.log('[loadLocationData] 위치 데이터 로딩 시작:', { mtIdx, date });

      // 위치 로그와 요약 정보를 병렬로 가져오기
      const [logs, summary] = await Promise.all([
        memberLocationLogService.getDailyLocationLogs(mtIdx, date),
        memberLocationLogService.getDailyLocationSummary(mtIdx, date)
      ]);

      // 위치 로그 데이터 설정
      setCurrentLocationLogs(logs);
      console.log('[loadLocationData] 위치 로그 데이터 로딩 완료:', logs.length, '개');

      // 요약 정보를 UI 형식으로 변환
      const formattedSummary: LocationSummary = {
        distance: summary.total_distance ? `${(summary.total_distance / 1000).toFixed(1)} km` : '0 km',
        time: summary.total_time ? formatTime(summary.total_time) : '0분',
        steps: summary.total_steps ? `${summary.total_steps.toLocaleString()} 걸음` : '0 걸음'
      };
      
      setLocationSummary(formattedSummary);
      console.log('[loadLocationData] 위치 요약 데이터 로딩 완료:', formattedSummary);

      // 지도에 위치 경로 표시 (나중에 구현)
      // updateLocationPath(logs);

    } catch (error) {
      console.error('[loadLocationData] 위치 데이터 로딩 오류:', error);
      
      // 오류 시 기본값으로 설정
      setCurrentLocationLogs([]);
      setLocationSummary(DEFAULT_LOCATION_SUMMARY);
    } finally {
      setIsLocationDataLoading(false);
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

  // useEffect for auto-selecting the first member (only sets state)
  useEffect(() => {
    if (isMapInitializedLogs && groupMembers.length > 0 && !groupMembers.some(m => m.isSelected)) {
      console.log("[LogsPage] Auto-selection: Setting first member as selected.");
      const updatedMembers = groupMembers.map((member, index) => ({
        ...member,
        isSelected: index === 0,
      }));
      setGroupMembers(updatedMembers);
      // setActiveLogView('members'); // setActiveLogView 호출은 아래 map update effect로 이동하거나 유지 결정 필요
    }
  }, [isMapInitializedLogs, groupMembers]);

  // useEffect for updating map and view based on groupMember selection
  useEffect(() => {
    if (isMapInitializedLogs && groupMembers.some(m => m.isSelected)) {
      console.log("[LogsPage] Member selection detected or map initialized with selection. Updating markers and view.");
      updateMemberMarkers(groupMembers);
      setActiveLogView('members'); // 멤버 선택/지도 업데이트 시 members 뷰 활성화
    } else if (isMapInitializedLogs) {
      // 선택된 멤버가 없을 경우 (예: 모든 선택 해제 시)
      // updateMemberMarkers([]); // 필요하다면 마커를 지우는 로직
    }
  }, [groupMembers, isMapInitializedLogs]); // updateMemberMarkers는 의존성 배열에서 제외 (함수가 재생성되지 않는다면)

  // 로그 뷰 스크롤 이벤트 핸들러
  const handleLogSwipeScroll = () => {
    if (logSwipeContainerRef.current) {
      const container = logSwipeContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.offsetWidth;
      const threshold = containerWidth / 2;

      const newView = scrollLeft < threshold ? 'members' : 'summary';
      if (activeLogView !== newView) {
        setActiveLogView(newView);
        
        // 위치기록 요약으로 스와이프할 때 바텀시트를 middle 상태로 변경
        if (newView === 'summary' && bottomSheetState !== 'middle') {
          setBottomSheetState('middle');
          console.log('[LOG_SWIPE] 위치기록 요약으로 스와이프 - 바텀시트 middle 상태로 변경');
        }
        // 그룹 멤버로 다시 스와이프할 때 바텀시트를 peek 상태로 변경
        else if (newView === 'members' && bottomSheetState === 'middle') {
          setBottomSheetState('peek');
          console.log('[LOG_SWIPE] 그룹 멤버로 스와이프 - 바텀시트 peek 상태로 변경');
        }
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
  const scrollToTodayDate = () => {
    if (dateScrollContainerRef.current) {
      const container = dateScrollContainerRef.current;
      // 즉시 스크롤을 맨 오른쪽으로 이동 (오늘 날짜 보이게)
      container.scrollLeft = container.scrollWidth;
      console.log('[날짜 스크롤] 오늘 날짜로 이동 완료');
    }
  };

  // 날짜 버튼 초기 스크롤 위치 설정 (오늘 날짜가 보이도록)
  useEffect(() => {
    // DOM이 완전히 렌더링된 후 실행하기 위해 requestAnimationFrame 사용
    const scheduleScroll = () => {
      requestAnimationFrame(() => {
        scrollToTodayDate();
      });
    };

    // 다양한 타이밍에 스크롤 시도
    setTimeout(scheduleScroll, 100);
    setTimeout(scheduleScroll, 300);
    setTimeout(scheduleScroll, 1000);
  }, []);

  // 그룹이 변경될 때도 오늘 날짜로 스크롤
  useEffect(() => {
    if (selectedGroupId) {
      setTimeout(scrollToTodayDate, 200);
    }
  }, [selectedGroupId]);

  // UserContext 데이터가 로딩 완료되면 첫 번째 그룹을 자동 선택
  useEffect(() => {
    if (!isUserDataLoading && userGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(userGroups[0].sgt_idx);
      console.log('[LOGS] UserContext에서 첫 번째 그룹 자동 선택:', userGroups[0].sgt_title);
    }
  }, [isUserDataLoading, userGroups, selectedGroupId]);

  // 그룹 멤버 및 스케줄 데이터 가져오기 (home/page.tsx와 동일)
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllGroupData = async () => {
      if (!isMounted) return;

      // selectedGroupId가 없으면 실행하지 않음
      if (!selectedGroupId) {
        console.log('[fetchAllGroupData] selectedGroupId가 없어서 실행하지 않음');
        return;
      }

      // 이미 데이터가 로드되었거나 로딩 중이면 중복 실행 방지
      if (dataFetchedRef.current.members) {
        return;
      }

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
          }
        }


      } catch (error) {
        console.error('[LOGS PAGE] 그룹 데이터(멤버 또는 스케줄) 조회 오류:', error);
        if (isMounted && !dataFetchedRef.current.members) {
          dataFetchedRef.current.members = true;
        }
      }
    };

    fetchAllGroupData();

    return () => { isMounted = false; };
  }, [selectedGroupId]);

  // 그룹 선택 핸들러
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 기존 데이터 초기화
    setGroupMembers([]);
    setFirstMemberSelected(false);
    dataFetchedRef.current = { members: false };
    
    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');
  };

  // 그룹별 멤버 수 조회
  useEffect(() => {
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log('[LOGS] 그룹 멤버 수 조회 시작:', userGroups.length, '개 그룹');
      
      const counts: Record<number, number> = {};
      
      await Promise.all(userGroups.map(async (group) => {
        try {
          const count = await getGroupMemberCount(group.sgt_idx);
          counts[group.sgt_idx] = count;
          console.log(`[LOGS] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수:`, count);
        } catch (error) {
          console.error(`[LOGS] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
          counts[group.sgt_idx] = 0;
        }
      }));
      
      setGroupMemberCounts(counts);
      console.log('[LOGS] 그룹 멤버 수 조회 완료:', counts);
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

  // 첫번째 멤버 자동 선택
  useEffect(() => {
    if (groupMembers.length > 0 && !groupMembers.some(m => m.isSelected) && !firstMemberSelected && dataFetchedRef.current.members) {
      console.log('[LOGS] 첫번째 멤버 자동 선택 시작:', groupMembers[0].name);
      
      setFirstMemberSelected(true);
      
      setTimeout(() => {
        console.log('[LOGS] 첫번째 멤버 자동 선택 실행:', groupMembers[0].id);
        handleMemberSelect(groupMembers[0].id, {} as React.MouseEvent);
      }, 500);
    }
  }, [groupMembers.length, firstMemberSelected, dataFetchedRef.current.members]);

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
        {/* 개선된 헤더 - 로딩 상태일 때 숨김 */}
        {!(isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) && (
          <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-20 glass-effect"
          >
            <div className="flex items-center justify-between h-16 px-4">
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
            </div>
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
            paddingTop: (isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) 
              ? '0px' 
              : '64px' 
          }}
        >
          <div ref={mapContainer} className="w-full h-full" />
        </div>

        {/* Bottom Sheet - home/page.tsx와 동일한 framer-motion 적용 */}
        {!(isMapLoading || !isMapInitializedLogs || !isInitialDataLoaded) && (
          <motion.div 
            ref={bottomSheetRef}
            variants={bottomSheetVariants}
            animate={bottomSheetState}
            className="fixed left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
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
              whileHover={{ scale: 1.2, backgroundColor: '#6366f1' }}
              transition={{ duration: 0.2 }}
            />

            {/* 바텀시트 내용 - 스크롤 가능하도록 수정 */}
            <div className="px-6 pb-2 overflow-y-auto max-h-full">
              <div 
                ref={logSwipeContainerRef}
                className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar mb-2 gap-2 bg-white"
                style={{
                  minHeight: '350px',
                  overflowY: 'visible',
                  overscrollBehavior: 'none',
                  WebkitOverflowScrolling: 'auto'
                }}
                onScroll={handleLogSwipeScroll}
              >
                <div className="w-full flex-shrink-0 snap-start overflow-visible bg-white">
                  <div className="content-section members-section min-h-[200px] max-h-[200px] overflow-y-auto mb-4 members-section-gradient rounded-xl p-4">
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="hide-scrollbar flex-1"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-3">
                          <div>
                            <h2 className="text-lg font-bold text-gray-900">그룹 멤버</h2>
                            <p className="text-sm text-gray-600">멤버들의 위치를 확인하세요</p>
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
                              className="relative w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
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

                  {/* logs/page.tsx의 날짜 선택 부분을 아래에 추가 */}
                  <motion.div 
                    className="bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 rounded-xl p-4 border border-purple-200 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <motion.div 
                      className="flex items-center space-x-2 mb-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.5 }}
                    >
                      <motion.div
                        initial={{ rotate: 0 }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, delay: 0.6 }}
                      >
                        <FiClock className="w-5 h-5 text-purple-600" />
                      </motion.div>
                      <h3 className="text-lg font-bold text-gray-900">날짜 선택</h3>
                      <motion.div 
                        className="text-sm text-gray-500"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.8 }}
                      >
                        ({getRecentDays().filter(day => day.hasLogs).length}일 기록 있음)
                      </motion.div>
                    </motion.div>
                    <motion.div 
                      ref={dateScrollContainerRef} 
                      className="flex space-x-2 overflow-x-auto pb-1.5 hide-scrollbar"
                      onLoad={() => scrollToTodayDate()}
                      style={{ scrollBehavior: 'auto' }}
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {getRecentDays().map((day, idx) => {
                        // 마지막 날짜 버튼(오늘)이 렌더링될 때 스크롤 트리거
                        if (idx === getRecentDays().length - 1) {
                          setTimeout(() => scrollToTodayDate(), 50);
                        }
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
                                transition: { duration: 0.3, delay: idx * 0.03 }
                              },
                              hover: { 
                                y: day.hasLogs || isSelected ? -3 : 0,
                                boxShadow: day.hasLogs || isSelected ? "0 4px 8px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.1)",
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
                            className={`px-3 py-2 rounded-lg flex-shrink-0 focus:outline-none text-sm min-w-[75px] h-10 flex flex-col justify-center items-center border transition-all duration-300 ${
                              isSelected
                                ? `bg-purple-600 text-white font-semibold shadow-lg border-purple-600 ${!day.hasLogs ? 'opacity-70' : ''}`
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
                    <motion.p 
                      className="text-xs text-gray-500 mt-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 1.2 }}
                    >
                      • 기록이 있는 날짜만 선택 가능합니다
                    </motion.p>
                  </motion.div>
                </div>

                <div className="w-full flex-shrink-0 snap-start overflow-hidden bg-white to-rose-50">
                  <div 
                    className="content-section summary-section min-h-[200px] max-h-[200px] overflow-hidden flex flex-col bg-gradient-to-r from-pink-50 to-rose-50"
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

              {/* 점 인디케이터 */}
              <div className={`flex-shrink-0 pb-3 bg-white transition-all duration-300 ${
                activeLogView === 'summary' ? '-mt-44 pt-5' : ''
              }`}>
                <div className="flex justify-center items-center space-x-2 mb-1">
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