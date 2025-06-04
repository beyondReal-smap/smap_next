'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useMotionValue } from 'framer-motion';
import { useUser } from '@/contexts/UserContext';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { Loader } from '@googlemaps/js-api-loader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiLoader, FiChevronDown, FiUser } from 'react-icons/fi';
import config, { API_KEYS, detectLanguage, MAP_CONFIG } from '../../config';
import mapService, { 
  MapType as MapTypeService, 
  MAP_API_KEYS, 
  Location, 
  cleanupGoogleMap, 
  cleanupNaverMap 
} from '../../services/mapService';
import memberService from '@/services/memberService';
import scheduleService from '../../services/scheduleService';
import groupService, { Group } from '@/services/groupService';
import { useAuth } from '@/contexts/AuthContext';
import authService from '@/services/authService';
import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../../types/enums';

declare global {
  interface Window {
    naver: any;
    google: any;
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
  mt_weather_sky?: string | number | null; mt_weather_tmx?: string | number | null;
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
    width: 52px; 
    height: 52px; 
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
  position: fixed;
  top: 0; /* 헤더 아래부터 시작하지 않고 화면 최상단부터 시작 */
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
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

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

// SSL 인증서 오류가 있는 URL인지 확인하는 함수
const isUnsafeImageUrl = (url: string | null): boolean => {
  if (!url) return true;
  
  // 알려진 문제가 있는 서버 URL들
  const unsafeHosts = [
    '118.67.130.71:8000',
    // 필요시 다른 문제가 있는 호스트들을 추가
  ];
  
  return unsafeHosts.some(host => url.includes(host));
};

// 안전한 이미지 URL을 반환하는 함수
const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
  if (isUnsafeImageUrl(photoUrl)) {
    return getDefaultImage(gender, index);
  }
  return photoUrl || getDefaultImage(gender, index);
};

// 날씨 정보 타입 정의
interface WeatherInfo {
  temp: string; 
  condition: string;
  icon: string;
  skyStatus?: string; // 백엔드 sky 코드 (선택적)
}

// PHP의 $arr_mt_weather_sky_icon, $arr_mt_weather_sky 와 유사한 매핑 객체
const weatherIconMap: { [key: string]: string } = {
  '1': '🌥️', // 구름 많음 (구름 뒤 해)
  '2': '☁️', // 흐림 (구름)
  '3': '🌦️', // 흐리고 비 (구름과 비)
  '4': '🌧️', // 비
  '5': '🌨️', // 비와 눈
  '6': '❄️', // 눈
  '7': '💨', // 눈날림 (바람으로 표현)
  '8': '☀️', // 맑음
  'default': '🌡️' // 기본값
};

const weatherConditionMap: { [key: string]: string } = {
  '1': '구름많음',
  '2': '흐림',
  '3': '흐리고 비',
  '4': '비',
  '5': '비/눈',
  '6': '눈',
  '7': '눈날림',
  '8': '맑음',
  'default': '날씨 정보 없음'
};

const getWeatherDisplayData = (skyStatus: string | undefined | null, tempMax: number | string | undefined | null): WeatherInfo => {
  const statusStr = String(skyStatus || 'default');
  const icon = weatherIconMap[statusStr] || weatherIconMap['default'];
  const condition = weatherConditionMap[statusStr] || weatherConditionMap['default'];
  
  let tempStr = '--°C';
  if (typeof tempMax === 'number') {
    tempStr = `${Math.round(tempMax)}°C`;
  } else if (typeof tempMax === 'string' && !isNaN(parseFloat(tempMax))) {
    tempStr = `${Math.round(parseFloat(tempMax))}°C`;
  } else if (tempMax === null || tempMax === undefined) {
    // 온도가 null 이나 undefined면 기본값 유지
  } else {
    tempStr = String(tempMax); // 숫자로 변환 불가능한 문자열이면 그대로 표시 (예: API가 가끔 문자열 온도를 줄 경우)
  }

  return {
    temp: tempStr,
    condition: condition,
    icon: icon,
    skyStatus: statusStr
  };
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
  const router = useRouter();
  // 인증 관련 상태 추가
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  // UserContext 사용
  const { userInfo, userGroups, isUserDataLoading, userDataError, refreshUserData, getGroupMemberCount, selectedGroupId, setSelectedGroupId } = useUser();
  
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
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd')); // 오늘 날짜로 초기화
  const [todayWeather, setTodayWeather] = useState<WeatherInfo>(getWeatherDisplayData(null, null));
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [mapType, setMapType] = useState<MapType>('google');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
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
  
  // 스크립트 로드 및 지도 초기화 상태 추적
  const [mapsInitialized, setMapsInitialized] = useState({
    google: false,
    naver: false
  });

  // Bottom Sheet 상태 관리 추가 - 3단계로 확장 (접힘, 중간, 펼쳐짐) - location/page.tsx 패턴 적용
  const [bottomSheetState, setBottomSheetState] = useState<'hidden' | 'peek'>('peek');
  const [currentTab, setCurrentTab] = useState<'members' | 'schedules'>('members'); // 현재 탭 상태 추가
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const startDragX = useRef<number | null>(null); // X 좌표용 ref 추가
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null); // 수평 스와이프 감지용 ref 추가

  const dataFetchedRef = useRef({ members: false, schedules: false }); // dataFetchedRef를 객체로 변경

  const [initialWeatherLoaded, setInitialWeatherLoaded] = useState(false);
  const initialWeatherDataRef = useRef<WeatherInfo | null>(null); // 앱 초기/기본 날씨 저장용
  const [groupSchedules, setGroupSchedules] = useState<Schedule[]>([]); // 그룹 전체 스케줄 (memberId 포함)
  // const [dataFetched, setDataFetched] = useState({ members: false, schedules: false }); // 삭제
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false); // 첫번째 멤버 선택 완료 상태 추가

  // 그룹 관련 상태 - UserContext로 대체됨
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [firstMemberSelected, setFirstMemberSelected] = useState(false); // 첫번째 멤버 선택 완료 추적

  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // 달력 스와이프 관련 상태 - calendarBaseDate 제거, x만 유지
  const x = useMotionValue(0); // 드래그 위치를 위한 motionValue

  // calendarBaseDate 관련 useEffect 제거 - 8일 고정이므로 불필요

  // useEffect를 사용하여 클라이언트 사이드에서 날짜 관련 상태 초기화
  useEffect(() => {
    const today = new Date();
    setSelectedDate(format(today, 'yyyy-MM-dd'));
    setDaysForCalendar(getNext7Days());
  }, []); // 빈 배열로 전달하여 마운트 시 1회 실행

  // Bottom Sheet 상태를 클래스 이름으로 변환
  const getBottomSheetClassName = () => {
    // 로딩 중일 때는 강제로 hidden 상태로 유지
    if (authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) {
      return 'bottom-sheet-hidden';
    }
    
    switch (bottomSheetState) {
      case 'hidden': return 'bottom-sheet-hidden';
      case 'peek': return 'bottom-sheet-peek';
      default: return 'bottom-sheet-hidden';
    }
  };

  // Bottom Sheet 드래그 핸들러 수정 - location/page.tsx와 동일한 로직 적용
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
    if (!isDraggingRef.current || !startDragY.current || !startDragX.current) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const target = e.target as HTMLElement;
    
    // 스케줄 스크롤 영역 체크
    const isInScheduleArea = target.closest('[data-schedule-scroll="true"]') || 
                            target.closest('[data-schedule-item="true"]') ||
                            target.closest('[data-calendar-swipe="true"]');
    
    if (isInScheduleArea) {
      // 스케줄 영역에서는 바텀시트 드래그 중단
      isDraggingRef.current = false;
      startDragY.current = null;
      startDragX.current = null;
      isHorizontalSwipeRef.current = null;
      return;
    }
    
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

      // 스와이프 방향에 따라 다음 탭 결정
      let nextTab: 'members' | 'schedules' = currentTab;
      
      if (deltaX < 0) { // 왼쪽으로 스와이프 (음수) -> 다음 탭
        if (currentTab === 'members') {
          nextTab = 'schedules';
        }
      } else { // 오른쪽으로 스와이프 (양수) -> 이전 탭
        if (currentTab === 'schedules') {
          nextTab = 'members';
        }
      }

      // 탭이 변경되면 즉시 적용하고 드래그 종료
      if (nextTab !== currentTab) {
        console.log('[SWIPE] 좌우 스와이프로 탭 변경:', currentTab, '→', nextTab);
        setCurrentTab(nextTab);
        
        // 햅틱 피드백
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([30, 10, 20]); // 더 강한 햅틱
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
        
        // 드래그 종료 처리
        startDragY.current = null;
        startDragX.current = null;
        isDraggingRef.current = false;
        dragStartTime.current = null;
        isHorizontalSwipeRef.current = null;
      }
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
    
    // 스케줄 스크롤 영역 체크
    const isInScheduleArea = target_element.closest('[data-schedule-scroll="true"]') || 
                            target_element.closest('[data-schedule-item="true"]') ||
                            target_element.closest('[data-calendar-swipe="true"]');
    
    if (isInScheduleArea) {
      // 스케줄 영역에서는 바텀시트 드래그 종료
      isDraggingRef.current = false;
      startDragY.current = null;
      startDragX.current = null;
      isHorizontalSwipeRef.current = null;
      return;
    }
    
    const dragDeltaY = clientY - startDragY.current;
    const dragDeltaX = clientX - startDragX.current;
    const deltaTime = dragStartTime.current ? performance.now() - dragStartTime.current : 0;
    
    // 탭 동작인지 확인 (짧은 시간 + 작은 움직임)
    const isTap = Math.abs(dragDeltaY) < 10 && Math.abs(dragDeltaX) < 10 && deltaTime < 200;
    
    console.log('[DragEnd] 드래그 종료:', {
      deltaY: dragDeltaY,
      deltaX: dragDeltaX,
      deltaTime,
      isTap,
      isHorizontalSwipe: isHorizontalSwipeRef.current,
      currentState: bottomSheetState,
      currentTab
    });

    // 좌우 스와이프였지만 거리가 부족한 경우에도 더 관대하게 처리
    if (isHorizontalSwipeRef.current === true) {
      const swipeThreshold = 20; // 임계값을 더 낮춤
      
      // 작은 스와이프도 탭 전환으로 처리
      if (Math.abs(dragDeltaX) >= swipeThreshold) {
        let nextTab: 'members' | 'schedules' = currentTab;
        
        if (dragDeltaX < 0 && currentTab === 'members') {
          nextTab = 'schedules';
        } else if (dragDeltaX > 0 && currentTab === 'schedules') {
          nextTab = 'members';
        }
        
        if (nextTab !== currentTab) {
          console.log('[SWIPE] 작은 스와이프로 탭 변경:', currentTab, '→', nextTab);
          setCurrentTab(nextTab);
          
          // 햅틱 피드백
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate([25, 5, 15]);
            }
          } catch (error) {
            console.debug('햅틱 피드백이 차단되었습니다:', error);
          }
        }
      }
      // 탭 동작: members에서 schedules로만 전환
      else if (isTap && currentTab === 'members') {
        console.log('[SWIPE] 탭으로 탭 변경:', currentTab, '→', 'schedules');
        setCurrentTab('schedules');
        
        // 햅틱 피드백
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([15]);
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
      }
      
      // 초기화
      startDragY.current = null;
      startDragX.current = null;
      isDraggingRef.current = false;
      dragStartTime.current = null;
      isHorizontalSwipeRef.current = null;
      (e.target as any)._startedAt = 0;
      return;
    }

    // 상하 드래그에 대한 바텀시트 상태 변경 (2단계만)
    if (isHorizontalSwipeRef.current === false || isHorizontalSwipeRef.current === null) {
      // 정확한 속도 계산
      const startTime = (e.target as any)._startedAt || performance.now() - 200;
      const duration = performance.now() - startTime;
      const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;
      
      const dragThreshold = 50;
      const velocityThreshold = 0.3;
      
      let nextState: 'hidden' | 'peek' = bottomSheetState;
      
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
      
      // 위로 드래그 (Y 감소) - 상태 확장
      if (dragDeltaY < 0) {
        if (bottomSheetState === 'hidden' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'peek';
          console.log('[DragEnd] 위로 드래그 감지 (hidden -> peek)');
          triggerHaptic();
        }
      }
      // 아래로 드래그 (Y 증가) - 상태 축소  
      else if (dragDeltaY > 0) {
        if (bottomSheetState === 'peek' && (Math.abs(dragDeltaY) > dragThreshold || velocityY > velocityThreshold)) {
          nextState = 'hidden';
          console.log('[DragEnd] 아래로 드래그 감지 (peek -> hidden)');
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
      const next = prev === 'hidden' ? 'peek' : 'hidden';
      console.log('[BOTTOM_SHEET] toggleBottomSheet 상태 변경:', prev, '→', next);
      return next;
    });
  };

  // 사용자 위치 및 지역명 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setIsLocationEnabled(true);
          
          // 정적 위치 정보 설정 (Geocoding API 대신 간단한 해결책)
          setLocationName("현재 위치");
        },
        (error) => {
          console.log('위치 정보를 가져올 수 없습니다:', error);
          setIsLocationEnabled(false);
        }
      );
    }
  }, []);

  // 그룹 멤버 및 스케줄 데이터 가져오기
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
      if (dataFetchedRef.current.members && dataFetchedRef.current.schedules) {
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
                  // 최신 위치 정보가 있으면 사용, 없으면 기본 위치 사용
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
                
                // 새로 추가된 위치 정보
                mlt_lat: member.mlt_lat,
                mlt_long: member.mlt_long,
                mlt_speed: member.mlt_speed,
                mlt_battery: member.mlt_battery,
                mlt_gps_time: member.mlt_gps_time,
                
                // 그룹 권한 정보
                sgdt_owner_chk: member.sgdt_owner_chk,
                sgdt_leader_chk: member.sgdt_leader_chk,
                sgdt_idx: member.sgdt_idx
              }));
            } else {
              console.warn('No member data from API, or API call failed.');
              setIsFirstMemberSelectionComplete(true);
            }
            setGroupMembers(currentMembers); 
            dataFetchedRef.current.members = true;
          }
        }

        if (dataFetchedRef.current.members && !dataFetchedRef.current.schedules) {
          const scheduleResponse = await scheduleService.getGroupSchedules(parseInt(groupIdToUse)); 
          if (isMounted) {
            const rawSchedules = scheduleResponse.data.schedules;
            if (rawSchedules && rawSchedules.length > 0) {
              console.log('[fetchAllGroupData] 원본 스케줄 데이터:', rawSchedules.map(s => ({
                id: s.id,
                title: s.title,
                date: s.date,
                sst_location_lat: s.sst_location_lat,
                sst_location_long: s.sst_location_long,
                location: s.location,
                sst_location_add: s.sst_location_add,
                mt_schedule_idx: s.mt_schedule_idx,
                sgdt_idx: s.sgdt_idx
              })));

              setGroupSchedules(rawSchedules); 
              setGroupMembers(prevMembers =>
                prevMembers.map(member => {
                  const memberSchedules = rawSchedules
                    .filter((schedule: Schedule) => 
                      schedule.sgdt_idx !== null && 
                      schedule.sgdt_idx !== undefined && 
                      Number(schedule.sgdt_idx) === Number(member.sgdt_idx)
                    );
                  
                  console.log(`[fetchAllGroupData] 멤버 ${member.name}의 스케줄:`, {
                    memberId: member.id,
                    memberSgdtIdx: member.sgdt_idx,
                    totalSchedules: memberSchedules.length,
                    schedulesWithLocation: memberSchedules.filter(s => s.sst_location_lat && s.sst_location_long).length,
                    scheduleDetails: memberSchedules.map(s => ({
                      id: s.id,
                      title: s.title,
                      date: s.date,
                      sgdt_idx: s.sgdt_idx,
                      sst_location_lat: s.sst_location_lat,
                      sst_location_long: s.sst_location_long,
                      hasLocation: !!(s.sst_location_lat && s.sst_location_long)
                    }))
                  });

                  return {
                    ...member,
                    schedules: memberSchedules
                  };
                })
              );
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const todaySchedules = rawSchedules.filter((s: Schedule) => s.date && s.date.startsWith(todayStr));
              console.log('[fetchAllGroupData] 오늘의 스케줄:', {
                todayStr,
                totalTodaySchedules: todaySchedules.length,
                schedulesWithLocation: todaySchedules.filter(s => s.sst_location_lat && s.sst_location_long).length
              });
              setFilteredSchedules(todaySchedules);
            } else {
              console.warn('No schedule data from API for the group, or API call failed.');
              setGroupSchedules([]);
              setFilteredSchedules([]);
            }
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
        if (isMounted && dataFetchedRef.current.members && dataFetchedRef.current.schedules) {
          if (isMapLoading) setIsMapLoading(false); 
          console.log("All group data fetch attempts completed.");
        }
      }
    };

    fetchAllGroupData();

    return () => { isMounted = false; };
  }, [selectedGroupId]); // selectedGroupId를 의존성에 추가

  // 컴포넌트 마운트 시 초기 지도 타입 설정
  useEffect(() => {
    // 네이버 지도를 기본으로 사용 (개발 환경에서도 네이버 지도 사용)
    setMapType('naver');
  }, []);

  // 컴포넌트 마운트 시 그룹 목록 불러오기
  // useEffect(() => {
  //   fetchUserGroups();
  // }, []); // UserContext로 대체되어 제거

  // 로그인 상태 확인 및 사용자 정보 초기화
  useEffect(() => {
    const initializeUserAuth = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) {
        return;
      }

      // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
      if (!isLoggedIn) {
        console.log('[HOME] 로그인되지 않음 - 로그인 페이지로 리다이렉트');
        router.push('/login');
        return;
      }

      // 사용자 정보가 있는 경우 초기화
      if (user) {
        setUserName(user.mt_name || '사용자');
        
        // mt_idx가 1186이 아닌 경우 1186으로 설정 (데모용)
        if (user.mt_idx !== 1186) {
          console.log('[HOME] 사용자 mt_idx를 1186으로 설정 (현재:', user.mt_idx, ')');
          
          // 로컬 스토리지의 사용자 데이터 업데이트
          const updatedUser = { ...user, mt_idx: 1186 };
          authService.setUserData(updatedUser);
          
          // 실제로는 백엔드 API에도 업데이트 요청을 보내야 할 수 있습니다
          // await authService.updateUserProfile(user.mt_idx, { mt_idx: 1186 });
        }

        // 사용자 위치 정보 설정
        if (user.mt_lat && user.mt_long) {
          const lat = typeof user.mt_lat === 'number' ? user.mt_lat : parseFloat(String(user.mt_lat));
          const lng = typeof user.mt_long === 'number' ? user.mt_long : parseFloat(String(user.mt_long));
          setUserLocation({ lat, lng });
        }

        // 사용자 지역 정보 설정
        if (user.mt_sido) {
          setLocationName(user.mt_sido + (user.mt_gu ? ' ' + user.mt_gu : ''));
        }

        console.log('[HOME] 사용자 정보 초기화 완료:', {
          mt_idx: user.mt_idx,
          name: user.mt_name,
          location: { lat: user.mt_lat, lng: user.mt_long }
        });
      }
    };

    initializeUserAuth();
  }, [authLoading, isLoggedIn, user, router]);

  // Google Maps API 로드 함수
  const loadGoogleMapsAPI = async () => {
    // 이미 로드된 경우 중복 로드 방지
    if (apiLoadStatus.google || window.google?.maps) {
      console.log('Google Maps API가 이미 로드되어 있습니다.');
      setGoogleMapsLoaded(true);
      apiLoadStatus.google = true;
      return;
    }

    try {
      console.log('Google Maps API 로드 시작');
      // Loader를 사용하여 비동기적으로 API 로드
      await googleMapsLoader.load();
      console.log('Google Maps API가 성공적으로 로드되었습니다.');
      apiLoadStatus.google = true;
      setGoogleMapsLoaded(true);
    } catch (error) {
      console.error('Google Maps API 로드 오류:', error);
    }
  };

  // Naver Maps API 로드 함수
  const loadNaverMapsAPI = () => {
    // 이미 로드된 경우 중복 로드 방지
    if (apiLoadStatus.naver || window.naver?.maps) {
      console.log('Naver Maps API가 이미 로드되어 있습니다.');
      setNaverMapsLoaded(true);
      apiLoadStatus.naver = true;
      return;
    }

    console.log('Naver Maps API 로드 시작');
    // 네이버 지도 API 로드용 URL 생성
    const naverMapUrl = new URL(`https://oapi.map.naver.com/openapi/v3/maps.js`);
    naverMapUrl.searchParams.append('ncpKeyId', NAVER_MAPS_CLIENT_ID);
    naverMapUrl.searchParams.append('submodules', 'panorama,geocoder,drawing,visualization');
    
    // script 요소 생성 및 로드
    const script = document.createElement('script');
    script.src = naverMapUrl.toString();
    script.async = true;
    script.defer = true;
    script.id = 'naver-maps-script';
    
    script.onload = () => {
      console.log('Naver Maps API가 성공적으로 로드되었습니다.');
      apiLoadStatus.naver = true;
      setNaverMapsLoaded(true);
    };
    
    script.onerror = () => {
      console.error('네이버 지도 스크립트 로드 실패');
      setMapType('google'); // 로드 실패 시 구글 지도로 전환
    };
    
    // 중복 로드 방지를 위해 기존 스크립트 제거
    const existingScript = document.getElementById('naver-maps-script');
    if (existingScript) {
      existingScript.remove();
    }
    
    document.head.appendChild(script);
  };

  // Google 지도 초기화 (로고 제거 옵션 추가)
  const initGoogleMap = () => {
    if (!googleMapContainer.current || !googleMapsLoaded || !window.google || !window.google.maps) {
      console.log('Google Maps 초기화를 위한 조건이 충족되지 않음');
      return;
    }

    try {
      // 기존 구글 지도 인스턴스가 있으면 마커만 업데이트
      if (map.current) {
        // 지도 중심 위치 및 마커 위치 업데이트
        map.current.setCenter(userLocation);
        if (marker.current) {
          marker.current.setPosition(userLocation);
        }
        return;
      }
      
      console.log('Google Maps 초기화 시작');
      setIsMapLoading(true);
      
      // 지도 생성
      const mapOptions = {
        ...MAP_CONFIG.GOOGLE.DEFAULT_OPTIONS,
        center: userLocation,
        // 로고 및 UI 컨트롤 숨김 옵션 추가
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      };
      
      map.current = new window.google.maps.Map(googleMapContainer.current, mapOptions);

      // 사용자 위치에 마커 추가
      marker.current = new window.google.maps.Marker({
        position: userLocation,
        map: map.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#4F46E5',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 8
        }
      });

      // 지도 로딩 완료
      window.google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
        setIsMapLoading(false);
        setMapsInitialized(prev => ({...prev, google: true}));
        console.log('Google Maps 타일 로딩 완료');
      });
      
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
      return;
    }

    try {
      // 기존 네이버 지도 인스턴스가 있으면 마커만 업데이트
      if (naverMap.current) {
        // 지도 중심 위치 및 마커 위치 업데이트
        const latlng = new window.naver.maps.LatLng(userLocation.lat, userLocation.lng);
        naverMap.current.setCenter(latlng);
        if (naverMarker.current) {
          naverMarker.current.setPosition(latlng);
        }
        return;
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
        // 지도 옵션에 MAP_CONFIG의 기본 설정 사용 + 로고 및 저작권 표시 숨김
        const mapOptions = {
          ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
          center: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
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
        
        // 지도가 로드된 후에만 마커 생성
        const initListener = window.naver.maps.Event.addListener(naverMap.current, 'init', () => {
          if (!authFailed && naverMap.current) {
            // 인증 실패가 아닌 경우에만 마커 생성
            try {
              naverMarker.current = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
                map: naverMap.current,
                icon: {
                  content: '<div style="width: 16px; height: 16px; background-color: #4F46E5; border: 2px solid #FFFFFF; border-radius: 50%;"></div>',
                  size: new window.naver.maps.Size(16, 16),
                  anchor: new window.naver.maps.Point(8, 8)
                }
              });
              
              console.log('Naver Maps 마커 생성 완료');
            } catch (markerError) {
              console.error('네이버 지도 마커 생성 오류:', markerError);
            }
          }
          
          setIsMapLoading(false);
          setMapsInitialized(prev => ({...prev, naver: true}));
          console.log('Naver Maps 초기화 완료');
          
          // 인증 오류 리스너 제거
          window.naver.maps.Event.removeListener(errorListener);
          window.naver.maps.Event.removeListener(initListener);
        });
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
  }, [mapType]);

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
  }, [userLocation, mapType, googleMapsLoaded, naverMapsLoaded]);
  
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

  // 컴포넌트 마운트 시 첫 번째 멤버 자동 선택 - 지도 초기화 후에 실행되도록 수정
  useEffect(() => {
    // 지도가 초기화된 후에만 첫 번째 멤버 선택
    if (groupMembers.length > 0 && 
        ((mapType === 'naver' && mapsInitialized.naver) || 
         (mapType === 'google' && mapsInitialized.google))) {
      console.log('지도 초기화 완료 후 첫 번째 멤버 선택:', groupMembers[0].name);
      
      // 약간의 지연 후 멤버 선택 (지도 렌더링이 완전히 완료되도록)
      const timerId = setTimeout(() => {
        handleMemberSelect(groupMembers[0].id);
      }, 500);
      
      // 클린업 함수로 타이머 정리
      return () => clearTimeout(timerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // 빈 의존성 배열로 변경하여 마운트 시 한 번만 실행

  // 지도 초기화 상태 변경 감지를 위한 별도 useEffect
  useEffect(() => {
    // 지도가 초기화되고 멤버가 있고 아직 선택된 멤버가 없을 때만 실행
    if ((mapType === 'naver' && mapsInitialized.naver) || 
        (mapType === 'google' && mapsInitialized.google)) {
      if (groupMembers.length > 0 && !groupMembers.some(m => m.isSelected) && !isFirstMemberSelectionComplete) {
        console.log('지도 초기화 감지 - 첫 번째 멤버 선택:', groupMembers[0].name);
        
        const timerId = setTimeout(() => {
          handleMemberSelect(groupMembers[0].id);
        }, 500);
        
        return () => clearTimeout(timerId);
      }
    }
  }, [mapsInitialized.naver, mapsInitialized.google, mapType, groupMembers, isFirstMemberSelectionComplete]);

  // 공통 좌표 파싱 함수
  const parseCoordinate = (coord: any): number | null => {
    if (typeof coord === 'number') return coord;
    if (typeof coord === 'string' && !isNaN(parseFloat(coord))) return parseFloat(coord);
    return null;
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

    if (markerType === 'member' && memberData) {
      lat = parseCoordinate(memberData.location.lat);
      lng = parseCoordinate(memberData.location.lng);
    } else if (markerType === 'schedule' && scheduleData) {
      lat = parseCoordinate(scheduleData.sst_location_lat);
      lng = parseCoordinate(scheduleData.sst_location_long);
    } else if (location) {
      lat = parseCoordinate(location.lat);
      lng = parseCoordinate(location.lng);
    }

    if (lat === null || lng === null || lat === 0 || lng === 0) {
      console.warn('유효하지 않은 좌표:', { lat, lng, location, markerType });
      return null;
    }

    const validLat = lat;
    const validLng = lng;

    if (mapType === 'naver' && naverMap.current && window.naver?.maps) {
      const naverPos = new window.naver.maps.LatLng(validLat, validLng);
      
      if (markerType === 'member' && memberData) {
        const photoForMarker = memberData.photo ?? getDefaultImage(memberData.mt_gender, memberData.original_index);
        // location/page.tsx와 동일한 인디고 색상 사용
        const borderColor = '#4F46E5';
        
        const newMarker = new window.naver.maps.Marker({
          position: naverPos,
          map: naverMap.current,
          title: memberData.name,
          icon: {
            content: `
              <div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
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

        const timeRange = (startTime && endTime) ? `${startTime} - ${endTime}` : (startTime || '시간 정보 없음');
        
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
            anchor: new window.naver.maps.Point(6, 52)
          }
        });

        // InfoWindow 추가
        if (window.naver.maps.InfoWindow) {
          const infoWindow = new window.naver.maps.InfoWindow({
            content: `<div style="padding:8px;font-size:13px;min-width:120px;text-align:left;line-height:1.5;"><strong>${scheduleTitle}</strong><br><span style="font-size:11px; color:#555;">시간: ${timeRange}</span><br><span style="font-size:11px; color:${statusDetail.color};">상태: ${statusDetail.text}</span></div>`,
            disableAnchor: true
          });
          window.naver.maps.Event.addListener(newMarker, 'click', () => {
            if (infoWindow.getMap()) {
              infoWindow.close();
            } else {
              infoWindow.open(naverMap.current, newMarker);
            }
          });
        }

        return newMarker;
      }
    } else if (mapType === 'google' && map.current && window.google?.maps) {
      if (markerType === 'member' && memberData) {
        const photoForMarker = memberData.photo ?? getDefaultImage(memberData.mt_gender, memberData.original_index);
        
        const newMarker = new window.google.maps.Marker({
          position: { lat: validLat, lng: validLng },
          map: map.current,
          title: memberData.name,
          icon: {
            url: photoForMarker,
            scaledSize: new window.google.maps.Size(32, 32),
            origin: new window.google.maps.Point(0, 0),
            anchor: new window.google.maps.Point(16, 16),
            labelOrigin: new window.google.maps.Point(16, 40)
          }
        });

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

        const timeRange = (startTime && endTime) ? `${startTime} - ${endTime}` : (startTime || '시간 정보 없음');

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

        // InfoWindow 추가
        if (window.google.maps.InfoWindow) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="font-size:13px;line-height:1.5;"><strong>${scheduleTitle}</strong><br><span style="font-size:11px;color:#555;">시간: ${timeRange}</span><br><span style="font-size:11px;color:${statusDetail.color};">상태: ${statusDetail.text}</span></div>`
          });
          newMarker.addListener('click', () => {
            infoWindow.open({
              anchor: newMarker,
              map: map.current,
              shouldFocus: false,
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
    // 바텀시트 드래그 상태 리셋 (멤버 클릭으로 인한 의도치 않은 상태 변경 방지)
    isDraggingRef.current = false;
    startDragY.current = null;
    dragStartTime.current = null;
    
    const updatedMembers = groupMembers.map(member => 
      member.id === id ? { ...member, isSelected: !member.isSelected } : { ...member, isSelected: false }
    );
    setGroupMembers(updatedMembers);
    const selectedMember = updatedMembers.find(member => member.isSelected);
    
    console.log('[handleMemberSelect] 멤버 선택:', {
      selectedMemberId: id,
      selectedMemberName: selectedMember?.name,
      selectedDate,
      totalGroupSchedules: groupSchedules.length
    });
    
    // 첫번째 멤버 선택 완료 상태 설정
    if (!isFirstMemberSelectionComplete && selectedMember) {
      setIsFirstMemberSelectionComplete(true);
      console.log('[HOME] 첫번째 멤버 선택 완료:', selectedMember.name);
    }
    
    if (selectedMember) {
      setTodayWeather(getWeatherDisplayData(String(selectedMember.mt_weather_sky ?? 'default'), selectedMember.mt_weather_tmx));
      
      const memberSchedules = selectedMember.schedules.filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(selectedDate));
      console.log('[handleMemberSelect] 선택된 멤버의 스케줄:', {
        memberName: selectedMember.name,
        totalMemberSchedules: selectedMember.schedules.length,
        filteredSchedules: memberSchedules.length,
        selectedDate,
        memberSchedulesDetail: selectedMember.schedules.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          hasLocation: !!(s.sst_location_lat && s.sst_location_long)
        }))
      });
      
      setFilteredSchedules(memberSchedules);
    } else {
      if (initialWeatherDataRef.current) setTodayWeather(initialWeatherDataRef.current);
      
      const allSchedules = groupSchedules
        .filter(s => typeof s.date === 'string' && s.date!.startsWith(selectedDate))
        .map(({memberId, ...rest}) => rest);
      
      console.log('[handleMemberSelect] 멤버 선택 해제 - 전체 스케줄:', {
        totalGroupSchedules: groupSchedules.length,
        filteredSchedules: allSchedules.length,
        selectedDate
      });
      
      setFilteredSchedules(allSchedules);
    }
    updateMemberMarkers(updatedMembers);
  };

  // 선택된 날짜 변경 핸들러 (filteredSchedules 업데이트)
  const handleDateSelect = (dateValue: string) => {
    console.log('[handleDateSelect] 날짜 선택:', {
      previousDate: selectedDate,
      newDate: dateValue
    });
    
    setSelectedDate(dateValue);
    const selectedMember = groupMembers.find(member => member.isSelected);
    
    if (selectedMember) {
      const memberSchedules = selectedMember.schedules.filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(dateValue));
      console.log('[handleDateSelect] 선택된 멤버의 날짜별 스케줄:', {
        memberName: selectedMember.name,
        selectedDate: dateValue,
        filteredSchedules: memberSchedules.length,
        schedulesDetail: memberSchedules.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          hasLocation: !!(s.sst_location_lat && s.sst_location_long)
        }))
      });
      setFilteredSchedules(memberSchedules);
    } else {
      const allSchedules = groupSchedules
        .filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(dateValue))
        .map(({memberId, ...rest}) => rest);
      
      console.log('[handleDateSelect] 전체 그룹의 날짜별 스케줄:', {
        selectedDate: dateValue,
        filteredSchedules: allSchedules.length,
        schedulesDetail: allSchedules.map(s => ({
          id: s.id,
          title: s.title,
          date: s.date,
          hasLocation: !!(s.sst_location_lat && s.sst_location_long)
        }))
      });
      setFilteredSchedules(allSchedules);
    }
  };

  // 멤버 마커 업데이트 함수 - 모든 그룹멤버 표시
  const updateMemberMarkers = (members: GroupMember[]) => {
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
      members.forEach((member, index) => {
        // 좌표 안전성 검사
        const lat = parseCoordinate(member.location.lat);
        const lng = parseCoordinate(member.location.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          if (mapType === 'naver' && naverMap.current && window.naver?.maps) {
            const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
            const position = new window.naver.maps.LatLng(lat, lng);
            // 선택된 멤버는 핑크색 외곽선, 일반 멤버는 인디고 외곽선
            const borderColor = member.isSelected ? '#EC4899' : '#4F46E5';
            
            const markerInstance = new window.naver.maps.Marker({
              position: position,
              map: naverMap.current,
              icon: {
                content: `
                  <div style="position: relative; text-align: center;">
                    <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                      <img 
                        src="${photoForMarker}" 
                        alt="${member.name}" 
                        style="width: 100%; height: 100%; object-fit: cover;" 
                        data-gender="${member.mt_gender ?? ''}" 
                        data-index="${member.original_index}"
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
                      ${member.name}
                    </div>
                  </div>
                `,
                size: new window.naver.maps.Size(36, 48), 
                anchor: new window.naver.maps.Point(18, 42) 
              },
              zIndex: member.isSelected ? 200 : 150 // 선택된 멤버가 위에 표시되도록
            });
            
            memberMarkers.current.push(markerInstance);
          } else if (mapType === 'google' && map.current && window.google?.maps) {
            const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
            
            const markerInstance = new window.google.maps.Marker({
              position: { lat, lng },
              map: map.current,
              title: member.name,
              icon: {
                url: photoForMarker,
                scaledSize: new window.google.maps.Size(32, 32),
                origin: new window.google.maps.Point(0, 0),
                anchor: new window.google.maps.Point(16, 16),
                labelOrigin: new window.google.maps.Point(16, 40)
              },
              zIndex: member.isSelected ? 200 : 150
            });
            
            memberMarkers.current.push(markerInstance);
          }
        } else {
          console.warn('유효하지 않은 멤버 좌표:', member.name, member.location);
        }
      });
      
      // 선택된 멤버가 있으면 해당 위치로 지도 이동
      const selectedMember = members.find(member => member.isSelected);
      if (selectedMember) {
        const lat = parseCoordinate(selectedMember.location.lat);
        const lng = parseCoordinate(selectedMember.location.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
            // 네이버 지도 이동 및 줌 레벨 조정
            setTimeout(() => {
              naverMap.current.setCenter(new window.naver.maps.LatLng(lat, lng));
              naverMap.current.setZoom(17);
              console.log('네이버 지도 중심 이동:', selectedMember.name, { lat, lng });
            }, 100);
          } else if (mapType === 'google' && map.current && googleMapsLoaded) {
            // 구글 지도 이동 및 줌 레벨 조정
            setTimeout(() => {
              map.current.panTo({ lat, lng });
              map.current.setZoom(17);
              console.log('구글 지도 중심 이동:', selectedMember.name, { lat, lng });
            }, 100);
          }
        } else {
          console.warn('유효하지 않은 멤버 좌표:', selectedMember.name, selectedMember.location);
        }
      } else if (members.length > 0) {
        // 선택된 멤버가 없으면 모든 멤버가 보이도록 지도 조정
        const validMembers = members.filter(member => {
          const lat = parseCoordinate(member.location.lat);
          const lng = parseCoordinate(member.location.lng);
          return lat !== null && lng !== null && lat !== 0 && lng !== 0;
        });

        if (validMembers.length > 0) {
          if (mapType === 'naver' && naverMap.current) {
            const bounds = new window.naver.maps.LatLngBounds();
            validMembers.forEach(member => {
              const lat = parseCoordinate(member.location.lat);
              const lng = parseCoordinate(member.location.lng);
              if (lat !== null && lng !== null) {
                bounds.extend(new window.naver.maps.LatLng(lat, lng));
              }
            });
            setTimeout(() => {
              naverMap.current.fitBounds(bounds, {
                padding: { top: 50, right: 50, bottom: 50, left: 50 }
              });
            }, 100);
          } else if (mapType === 'google' && map.current) {
            const bounds = new window.google.maps.LatLngBounds();
            validMembers.forEach(member => {
              const lat = parseCoordinate(member.location.lat);
              const lng = parseCoordinate(member.location.lng);
              if (lat !== null && lng !== null) {
                bounds.extend({ lat, lng });
              }
            });
            setTimeout(() => {
              map.current.fitBounds(bounds);
            }, 100);
          }
        }
      }
    }
  };

  // 지도 타입 변경 시 멤버 마커 업데이트
  useEffect(() => {
    if (
      (mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
      (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps)
    ) {
      updateMemberMarkers(groupMembers);
      updateScheduleMarkers(filteredSchedules); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType, mapsInitialized.google, mapsInitialized.naver]);

  // 그룹멤버 데이터 변경 시 마커 업데이트
  useEffect(() => {
    if (
      groupMembers.length > 0 &&
      ((mapType === 'naver' && naverMap.current && mapsInitialized.naver && window.naver?.maps) || 
       (mapType === 'google' && map.current && mapsInitialized.google && window.google?.maps))
    ) {
      console.log('[HOME] 그룹멤버 데이터 변경 감지 - 마커 업데이트:', groupMembers.length, '명');
      updateMemberMarkers(groupMembers);
    }
  }, [groupMembers, mapType, mapsInitialized.naver, mapsInitialized.google]);

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
            const naverLatLng = new window.naver.maps.LatLng(latitude, longitude);
            naverMap.current.setCenter(naverLatLng);
            naverMap.current.setZoom(14);
            
            if (naverMarker.current) {
              naverMarker.current.setPosition(naverLatLng);
            }
          } else if (mapType === 'google' && map.current && googleMapsLoaded) {
            map.current.panTo({ lat: latitude, lng: longitude });
            map.current.setZoom(14);
            
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

  // 헤더와 컨트롤 버튼의 클래스를 상태에 따라 결정하는 함수 수정
  const getHeaderClassName = () => {
    switch (bottomSheetState) {
      case 'hidden': return 'fixed bottom-[110px] left-4 z-10 opacity-100';
      case 'peek': return 'fixed bottom-[110px] left-4 z-10 opacity-100';
      default: return 'fixed bottom-[110px] left-4 z-10 opacity-100';
    }
  };

  // 컨트롤 버튼 클래스 별도 관리
  const getControlsClassName = () => {
    switch (bottomSheetState) {
      case 'hidden': return 'fixed bottom-[110px] right-4 z-10';
      case 'peek': return 'fixed bottom-[110px] right-4 z-10';
      default: return 'fixed bottom-[110px] right-4 z-10';
    }
  };

  // 날씨 정보 가져오기 useEffect
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        // 실제 API 호출로 변경 필요: 예시 memberService.getCurrentWeather()
        // 이 API는 { sky: "8", temp_max: 25, ... } 형태의 객체를 반환한다고 가정합니다.
        // 지금은 PHP 로직을 참고하여 임시 데이터를 사용합니다.
        // 예시: const weatherDataFromApi = await memberService.getWeatherData();
        
        // 임시 데이터 (PHP 로직의 결과라고 가정)
        // 실제로는 API 호출 후 그 결과를 사용해야 합니다.
        const exampleSkyFromApi = '8'; // PHP의 $get_weather_status 값 예시
        const exampleTempMaxFromApi = 28; // PHP의 $get_weather_max 값 예시

        console.log('[HOME PAGE] Fetched Weather Data (Example): ', { sky: exampleSkyFromApi, temp_max: exampleTempMaxFromApi });
        setTodayWeather(getWeatherDisplayData(exampleSkyFromApi, exampleTempMaxFromApi));

      } catch (error) {
        console.error('[HOME PAGE] 날씨 정보 조회 오류:', error);
        setTodayWeather(getWeatherDisplayData('default', null)); // 오류 시 기본값
      }
    };

    fetchWeatherData();
    // 필요하다면 일정 간격으로 날씨 정보 업데이트 (setInterval, clearInterval)
  }, []); // 마운트 시 1회 실행

  // 앱 초기/기본 날씨 로드 useEffect
  useEffect(() => {
    // 이 useEffect는 마운트 시 한 번만 실행되어 초기 날씨를 가져옵니다.
    // initialWeatherLoaded 상태는 다른 로직에서 이 초기 로드가 완료되었는지 확인하는 용도로 사용될 수 있습니다.
    const fetchInitialWeatherDataOnce = async () => {
      if (initialWeatherLoaded) return; // 이미 로드 시도했으면 중복 방지

      try {
        // TODO: 실제 API 호출 (예: 사용자 위치 기반 날씨)
        const exampleSkyFromApi = '8'; 
        const exampleTempMaxFromApi = 25; 
        const initialWeather = getWeatherDisplayData(exampleSkyFromApi, exampleTempMaxFromApi);
        setTodayWeather(initialWeather);
        initialWeatherDataRef.current = initialWeather;
      } catch (error) {
        console.error('[HOME PAGE] 초기 날씨 정보 조회 오류:', error);
        const defaultWeather = getWeatherDisplayData('default', null);
        setTodayWeather(defaultWeather);
        initialWeatherDataRef.current = defaultWeather;
      } finally {
        setInitialWeatherLoaded(true); // 성공/실패 여부와 관계없이 로드 시도 완료
      }
    };

    fetchInitialWeatherDataOnce();
  }, [initialWeatherLoaded]); // initialWeatherLoaded를 의존성에 넣어, true가 되면 더 이상 실행되지 않도록 함
                                 // 또는 [] 로 하고 내부에서 initialWeatherLoaded 체크

  // 그룹 선택 핸들러 - location/page.tsx와 동일한 패턴으로 수정
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 바텀시트를 peek 상태로 변경
    setBottomSheetState('peek');
    
    // 기존 데이터 초기화 - location/page.tsx와 동일한 패턴
    setGroupMembers([]);
    setGroupSchedules([]);
    setFilteredSchedules([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
    dataFetchedRef.current = { members: false, schedules: false };
    
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

  // 첫번째 멤버 자동 선택 - location/page.tsx와 동일한 패턴 추가
  useEffect(() => {
    if (groupMembers.length > 0 && !groupMembers.some(m => m.isSelected) && !firstMemberSelected && dataFetchedRef.current.members && dataFetchedRef.current.schedules) {
      console.log('[HOME] 첫번째 멤버 자동 선택 시작:', groupMembers[0].name);
      
      // 상태를 즉시 설정하여 중복 실행 방지
      setFirstMemberSelected(true);
      
      setTimeout(() => {
        console.log('[HOME] 첫번째 멤버 자동 선택 실행:', groupMembers[0].id);
        handleMemberSelect(groupMembers[0].id);
      }, 500);
    }
  }, [groupMembers.length, firstMemberSelected, dataFetchedRef.current.members, dataFetchedRef.current.schedules]);


  // 개선된 바텀시트 애니메이션 variants - location/page.tsx에서 가져옴
  const bottomSheetVariants = {
    hidden: { 
      top: '90vh', // 더 아래로 내려서 드래그 인식 개선 (90vh -> 95vh)
      bottom: '0px', // 높이 고정을 위해 bottom 추가
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
      top: '65vh', // 2단계이므로 더 크게 열림
      bottom: '0px', // 높이 고정을 위해 bottom 추가
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

  // 상태 추가
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});

  // 그룹별 멤버 수 조회 (userGroups가 변경될 때만)
  useEffect(() => {
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log('[HOME] 그룹 멤버 수 조회 시작:', userGroups.length, '개 그룹');
      
      const counts: Record<number, number> = {};
      
      // 모든 그룹의 멤버 수를 병렬로 조회
      await Promise.all(userGroups.map(async (group) => {
        try {
          const count = await getGroupMemberCount(group.sgt_idx);
          counts[group.sgt_idx] = count;
          console.log(`[HOME] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수:`, count);
        } catch (error) {
          console.error(`[HOME] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
          counts[group.sgt_idx] = 0;
        }
      }));
      
      setGroupMemberCounts(counts);
      console.log('[HOME] 그룹 멤버 수 조회 완료:', counts);
    };

    fetchGroupMemberCounts();
  }, [userGroups, getGroupMemberCount]);

  return (
    <>
      <style jsx global>{mobileStyles}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen relative overflow-hidden"
      >
        {/* 개선된 헤더 - 로딩 상태일 때 숨김 */}
        {!(authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-50 glass-effect"
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </motion.div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">홈</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들과 실시간으로 소통해보세요</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-1 hover:bg-white/50 rounded-xl transition-all duration-200 relative"
                  onClick={() => router.push('/notice')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {/* 알림 뱃지 (선택적) */}
                  <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full">
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-1 hover:bg-white/50 rounded-xl transition-all duration-200"
                  onClick={() => router.push('/setting')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </motion.header>
        )}

        {/* 지도 영역 (화면 100% 차지, fixed 포지션으로 고정) */}
        <div 
          className="full-map-container" 
          style={{ 
            paddingTop: (authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) 
              ? '0px' 
              : '64px' 
          }}
        >
          {/* 전체화면 로딩 - 체크리스트 형태 */}
          {(authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
            <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
              <div className="text-center max-w-sm mx-auto px-6">
                {/* 상단 로고 및 제목 */}
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-white stroke-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">홈 화면을 준비하고 있습니다</h2>
                  <p className="text-sm text-gray-600">잠시만 기다려주세요...</p>
                </div>

                {/* 로딩 체크리스트 - 컴팩트 버전 */}
                <div className="space-y-1">
                  {/* 1. 로그인 정보 확인 */}
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      !authLoading 
                        ? 'bg-green-500 border-green-500 scale-110' 
                        : 'border-indigo-300 animate-pulse'
                    }`}>
                      {!authLoading ? (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                      !authLoading ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      로그인 정보 확인
                    </span>
                  </div>

                  {/* 2. 지도 로딩 */}
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      !authLoading && !isMapLoading 
                        ? 'bg-green-500 border-green-500 scale-110' 
                        : authLoading 
                          ? 'border-gray-300' 
                          : 'border-indigo-300 animate-pulse'
                    }`}>
                      {!authLoading && !isMapLoading ? (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : !authLoading ? (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                      !authLoading && !isMapLoading ? 'text-green-700' : authLoading ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      지도 불러오기
                    </span>
                  </div>

                  {/* 3. 그룹 멤버 데이터 */}
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      !authLoading && !isMapLoading && dataFetchedRef.current.members 
                        ? 'bg-green-500 border-green-500 scale-110' 
                        : (authLoading || isMapLoading) 
                          ? 'border-gray-300' 
                          : 'border-indigo-300 animate-pulse'
                    }`}>
                      {!authLoading && !isMapLoading && dataFetchedRef.current.members ? (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : !authLoading && !isMapLoading ? (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                      !authLoading && !isMapLoading && dataFetchedRef.current.members ? 'text-green-700' : (authLoading || isMapLoading) ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      그룹 멤버 불러오기
                    </span>
                  </div>

                  {/* 4. 일정 데이터 */}
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      !authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules 
                        ? 'bg-green-500 border-green-500 scale-110' 
                        : (authLoading || isMapLoading || !dataFetchedRef.current.members) 
                          ? 'border-gray-300' 
                          : 'border-indigo-300 animate-pulse'
                    }`}>
                      {!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules ? (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : !authLoading && !isMapLoading && dataFetchedRef.current.members ? (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                      !authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules ? 'text-green-700' : (authLoading || isMapLoading || !dataFetchedRef.current.members) ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      일정 데이터 불러오기
                    </span>
                  </div>

                  {/* 5. 첫번째 멤버 위치 이동 */}
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-white/60 backdrop-blur-sm border border-white/20">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      isFirstMemberSelectionComplete 
                        ? 'bg-green-500 border-green-500 scale-110' 
                        : (!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules)
                          ? 'border-indigo-300 animate-pulse' 
                          : 'border-gray-300'
                    }`}>
                      {isFirstMemberSelectionComplete ? (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules) ? (
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium transition-colors duration-300 ${
                      isFirstMemberSelectionComplete ? 'text-green-700' : (!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules) ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      멤버 위치로 이동
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
                          (!authLoading ? 20 : 0) +
                          (!authLoading && !isMapLoading ? 20 : 0) +
                          (!authLoading && !isMapLoading && dataFetchedRef.current.members ? 20 : 0) +
                          (!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules ? 20 : 0) +
                          (isFirstMemberSelectionComplete ? 20 : 0)
                        }%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {(!authLoading ? 1 : 0) +
                     (!authLoading && !isMapLoading ? 1 : 0) +
                     (!authLoading && !isMapLoading && dataFetchedRef.current.members ? 1 : 0) +
                     (!authLoading && !isMapLoading && dataFetchedRef.current.members && dataFetchedRef.current.schedules ? 1 : 0) +
                     (isFirstMemberSelectionComplete ? 1 : 0)}/5 단계 완료
                  </p>
                </div>
              </div>
            </div>
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

        {/* 지도 헤더 - 바텀시트 상태에 따라 위치 변경 */}
        {!(authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <div 
            className={`${getHeaderClassName()} map-header`}
          >
            {isLocationEnabled && (
              <span className="absolute top-1 right-1 inline-flex items-center justify-center w-2 h-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
              </span>
            )}
            <div className="flex flex-col items-center w-full">
              <span className="text-lg">{todayWeather.icon}</span>
              <span className="text-sm font-medium">{todayWeather.temp}</span>
              <span className="text-xs text-white">{todayWeather.condition}</span>
            </div>
          </div>
        )}
        
        {/* 지도 컨트롤 버튼들 - 바텀시트 상태에 따라 위치 변경 */}
        {!(authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <div className={`${getControlsClassName()} map-controls`}>
            <button 
              onClick={() => updateMapPosition()}
              className="map-control-button"
              aria-label="내 위치로 이동"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* Bottom Sheet - 끌어올리거나 내릴 수 있는 패널 */}
        {!(authLoading || isMapLoading || isUserDataLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
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
            {/* 바텀시트 핸들 - location/page.tsx와 동일한 스타일 */}
            <motion.div 
              className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-3 cursor-grab active:cursor-grabbing"
              whileHover={{ scale: 1.2, backgroundColor: '#6366f1' }}
              transition={{ duration: 0.2 }}
            />

            {/* 점 인디케이터 */}
            {/* 
            <div className="flex justify-center items-center space-x-2 mb-4">
              <motion.div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentTab === 'members' ? 'bg-indigo-600 w-6' : 'bg-gray-300'
                }`}
                layoutId="tab-indicator"
              />
              <motion.div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentTab === 'schedules' ? 'bg-pink-600 w-6' : 'bg-gray-300'
                }`}
                layoutId="tab-indicator"
              />
            </div>

            {/* 바텀시트 내용 */}
            <div className="w-full h-full flex flex-col overflow-hidden">
              {/* 스와이프 가능한 콘텐츠 컨테이너 */}
              <div className="flex-grow min-h-0 relative overflow-hidden">
                <motion.div
                  className="flex w-[200%] h-full"
                  animate={{
                    x: currentTab === 'members' ? '0%' : '-50%'
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    duration: 0.5
                  }}
                  style={{ touchAction: 'pan-x' }}
                >
                  {/* 그룹 멤버 탭 */}
                  <div className="w-1/2 h-full px-6 pb-2 overflow-y-auto hide-scrollbar flex-shrink-0 flex flex-col" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100 hide-scrollbar h-[200px]"
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
                                className="absolute top-16 right-0 z-50 min-w-[200px] bg-white border border-indigo-200 rounded-xl shadow-xl overflow-hidden"
                                onClick={(e) => {
                                  // 드롭다운 메뉴 내부 클릭 시 이벤트 버블링 방지
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
                                          handleGroupSelect(group.sgt_idx);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors duration-150 flex items-center justify-between ${
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
                                handleMemberSelect(groupMembers[0].id);
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
                                    handleMemberSelect(member.id);
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
                                        target.onerror = () => {};
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

                  {/* 멤버 일정 탭 */}
                  <div className="w-1/2 h-full px-6 pb-2 overflow-y-auto hide-scrollbar flex-shrink-0 flex flex-col" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl border border-pink-100 flex-grow"
                    >
                      {/* 고정 헤더 부분 */}
                      <div className="sticky top-0 z-20 bg-gradient-to-r from-pink-50 to-rose-50 rounded-t-2xl pt-4 px-6 border-b border-pink-100/50 backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h2 className="text-lg font-bold text-gray-900">
                              {groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 일정` : '오늘의 일정'}
                            </h2>
                            <p className="text-sm text-gray-600">예정된 일정을 확인하세요</p>
                          </div>
                          {groupMembers.some(m => m.isSelected) ? (
                            <motion.button
                              whileHover={{ scale: 1.02, y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const selectedMember = groupMembers.find(m => m.isSelected);
                                if (selectedMember) {
                                  router.push(`/schedule/add?memberId=${selectedMember.id}&memberName=${selectedMember.name}&from=home`);
                                }
                              }}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-pink-700 bg-pink-50 hover:bg-pink-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 mobile-button"
                            >
                            </motion.button>
                          ) : (
                            <Link href="/schedule" className="text-sm font-medium text-pink-600 hover:text-pink-800 flex items-center mobile-button">
                              더보기
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </Link>
                          )}
                        </div>

                        {/* 날짜 선택 */}
                        <div className="mb-1 overflow-hidden" data-calendar-swipe="true">
                          <div className="mb-1 relative min-h-[50px] overflow-x-hidden"> 
                              <motion.div
                                className="flex space-x-2 pb-2 cursor-grab active:cursor-grabbing"
                                style={{ x }} 
                                drag="x"
                                dragConstraints={{ left: -280, right: 8 }}
                                data-calendar-swipe="true"
                                onDragStart={() => {
                                  isDraggingRef.current = true;
                                  console.log('📅 [Calendar] Drag Start');
                                }}
                                onDragEnd={(e, info) => {
                                  console.log('📅 [Calendar] Drag End - offset:', info.offset.x, 'velocity:', info.velocity.x);
                                  setTimeout(() => { isDraggingRef.current = false; }, 50);

                                  const buttonWidth = 88;
                                  const maxScroll = -(buttonWidth * 3);
                                  const minScroll = 10;

                                  const swipeThreshold = 50;
                                  const velocityThreshold = 200;
                                  const currentX = x.get();
                                  let targetX = currentX;

                                  if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                                    targetX = currentX - buttonWidth;
                                  } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                                    targetX = currentX + buttonWidth;
                                  } else {
                                    const snapPosition = Math.round(currentX / buttonWidth) * buttonWidth;
                                    targetX = snapPosition;
                                  }

                                  targetX = Math.max(maxScroll, Math.min(minScroll, targetX));
                                  
                                  console.log('📅 [Calendar] 목표 위치:', targetX, '(범위:', maxScroll, '~', minScroll, ')');
                                  x.set(targetX);
                                  
                                  try { 
                                    if ('vibrate' in navigator) navigator.vibrate([15]); 
                                  } catch (err) { 
                                    console.debug('햅틱 차단'); 
                                  }
                                }}
                              >
                                {daysForCalendar.map((day, idx) => (
                                  <motion.button
                                    key={day.value}
                                    onClick={() => {
                                      if (!isDraggingRef.current) {
                                        handleDateSelect(day.value);
                                      }
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                    data-calendar-swipe="true"
                                    className={`px-2 py-2 rounded-lg flex-shrink-0 text-center transition-colors duration-150 min-h-[20px] min-w-[80px] focus:outline-none ${
                                      selectedDate === day.value
                                        ? 'bg-pink-600 text-white font-semibold shadow-md'
                                        : 'bg-white text-gray-700 hover:bg-pink-50 border border-pink-100'
                                    }`}
                                  >
                                    <div className="text-sm font-medium leading-tight" data-calendar-swipe="true">{day.display}</div>
                                  </motion.button>
                                ))}
                              </motion.div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 스크롤 가능한 일정 목록 */}
                      <div className="px-6 pb-4">
                        {filteredSchedules.length > 0 ? (
                          <motion.div 
                            className="space-y-3 max-h-[300px] overflow-y-auto hide-scrollbar pr-1"
                            style={{ 
                              WebkitOverflowScrolling: 'touch', 
                              touchAction: 'pan-y',
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none'
                            }}
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              isDraggingRef.current = false;
                              startDragY.current = null;
                            }}
                            onTouchMove={(e) => {
                              e.stopPropagation();
                              isDraggingRef.current = false;
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                              isDraggingRef.current = false;
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              isDraggingRef.current = false;
                              startDragY.current = null;
                            }}
                            onMouseMove={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseUp={(e) => {
                              e.stopPropagation();
                            }}
                            data-schedule-scroll="true"
                          >
                            {filteredSchedules.map((schedule, index) => {
                              let formattedTime = '시간 정보 없음';
                              if (schedule.date) {
                                try {
                                  const dateObj = new Date(schedule.date);
                                  if (!isNaN(dateObj.getTime())) {
                                    formattedTime = format(dateObj, 'a h:mm', { locale: ko });
                                  }
                                } catch (e) {
                                  console.error("Error formatting schedule date:", e);
                                }
                              }

                              const displayLocation = schedule.location || schedule.slt_idx_t;
                              const statusData = getScheduleStatus(schedule);

                              return (
                                <motion.div
                                  key={schedule.id}
                                  custom={index}
                                  variants={staggerItem}
                                  whileHover={{ scale: 1.01, y: -2 }}
                                  whileTap={{ scale: 0.99 }}
                                  className="relative"
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    isDraggingRef.current = false;
                                  }}
                                  onTouchMove={(e) => {
                                    e.stopPropagation();
                                    isDraggingRef.current = false;
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    isDraggingRef.current = false;
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    isDraggingRef.current = false;
                                  }}
                                  data-schedule-item="true"
                                >
                                  <Link href={`/schedule/${schedule.id}`} className="block">
                                    <div className="p-4 rounded-xl bg-white border border-pink-100 hover:border-pink-200 hover:shadow-md transition-all duration-200">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <h3 className="font-semibold text-gray-900 text-base mb-2">{schedule.title}</h3>
                                          
                                          <div className="flex items-center text-sm text-gray-600 mb-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-pink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="font-medium">{formattedTime}</span>
                                          </div>

                                          {displayLocation && (
                                            <div className="flex items-center text-sm text-gray-500 mb-3">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-pink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                              </svg>
                                              <span>{displayLocation}</span>
                                            </div>
                                          )}

                                          <div 
                                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                                            style={{ 
                                              backgroundColor: statusData.bgColor, 
                                              color: statusData.color 
                                            }}
                                          >
                                            {statusData.text}
                                          </div>
                                        </div>
                                        
                                        <div className="ml-4 flex-shrink-0 self-center">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  </Link>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        ) : (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-8 bg-white rounded-xl border border-pink-100"
                          >
                            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-500 font-medium mb-1">
                              {groupMembers.some(m => m.isSelected) ? '선택한 멤버의 일정이 없습니다' : '오늘 일정이 없습니다'}
                            </p>
                            <p className="text-gray-400 text-sm">새로운 일정을 추가해보세요</p>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>

                    {/* 그룹 멤버 점 인디케이터 */}
                    <div className="flex justify-center items-center space-x-2 mt-4 mb-2">
                      <motion.div
                        className="bg-gray-300 w-2 h-2 rounded-full"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                      <motion.div
                        className="bg-pink-600 w-6 h-2 rounded-full"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* 좌우 스와이프 힌트 */}
                {currentTab === 'members' && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 0.6, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
                  >
                    <div className="flex items-center text-gray-400">
                      <span className="text-xs mr-1">일정</span>
                      <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.div>
                )}
                {currentTab === 'schedules' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 0.6, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none"
                  >
                    <div className="flex items-center text-gray-400">
                      <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="text-xs ml-1">멤버</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
} 