'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { Loader } from '@googlemaps/js-api-loader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiLoader, FiChevronDown } from 'react-icons/fi'; // 필요한 아이콘들 추가
// 공통 설정 및 서비스 임포트
import config, { API_KEYS, detectLanguage, MAP_CONFIG } from '../../config';
import mapService, { 
  MapType as MapTypeService, 
  MAP_API_KEYS, 
  Location, 
  cleanupGoogleMap, 
  cleanupNaverMap 
} from '../../services/mapService';
import memberService from '@/services/memberService'; // 멤버 서비스 추가
import scheduleService from '../../services/scheduleService'; // scheduleService 임포트
import groupService, { Group } from '@/services/groupService'; // 그룹 서비스 추가
import { 
    AllDayCheckEnum, ShowEnum, ScheduleAlarmCheckEnum, InCheckEnum, ScheduleCheckEnum 
} from '../../types/enums'; // 생성한 Enum 타입 임포트

// window 전역 객체에 naver 및 google 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
    google: any;
  }
}

// 지도 API 키 설정 (공통 설정 파일에서 가져옴)
const GOOGLE_MAPS_API_KEY = MAP_API_KEYS.GOOGLE;
const NAVER_MAPS_CLIENT_ID = MAP_API_KEYS.NAVER_CLIENT_ID;

// 바텀시트 위치 상수 정의 (3단계)
const BOTTOM_SHEET_POSITIONS = {
  COLLAPSED_HEIGHT: 100, // 접혔을 때 하단에서 올라온 높이
  MIDDLE_PERCENTAGE: 0.68, // 중간 상태: translateY(68%)
  EXPANDED_PERCENTAGE: 0.15, // 펼쳤을 때: translateY(15%) = 85% 화면 높이
  TRANSITION_DURATION: '0.5s',
  TRANSITION_TIMING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  MIN_DRAG_DISTANCE: 80 // 상태 전환을 위한 최소 드래그 거리
};

// 추천 장소 더미 데이터
const RECOMMENDED_PLACES = [
  { 
    id: '1', 
    title: '스타벅스 강남점', 
    distance: 0.3, 
    address: '서울시 강남구 역삼동 123-45',
    tel: '02-1234-5678',
    url: 'https://www.starbucks.co.kr'
  },
  { 
    id: '2', 
    title: '투썸플레이스 서초점', 
    distance: 0.5, 
    address: '서울시 서초구 서초동 456-78',
    tel: '02-2345-6789',
    url: 'https://www.twosome.co.kr'
  }
];

// 그룹멤버 더미 데이터 - 위치 정보 추가
const MOCK_GROUP_MEMBERS: GroupMember[] = [
  { 
    id: '1', name: '김철수', photo: '/images/avatar3.png', isSelected: false,
    location: { lat: 37.5642 + 0.005, lng: 127.0016 + 0.002 },
    schedules: [
      { id: 'm1-1', title: '팀 회의', date: '오늘 14:00', location: '강남 사무실' },
      { id: 'm1-2', title: '저녁 약속', date: '오늘 19:00', location: '이탈리안 레스토랑' }
    ],
    original_index: 0, mt_gender: 1, 
    mt_weather_sky: '8', mt_weather_tmx: 25 // 예시 날씨 정보
  },
  { 
    id: '2', name: '이영희', photo: '/images/avatar1.png', isSelected: false,
    location: { lat: 37.5642 - 0.003, lng: 127.0016 - 0.005 },
    schedules: [
      { id: 'm2-1', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' }
    ],
    original_index: 1, mt_gender: 2,
    mt_weather_sky: '1', mt_weather_tmx: 22 // 예시 날씨 정보
  },
  { 
    id: '3', name: '박민수', photo: '/images/avatar2.png', isSelected: false,
    location: { lat: 37.5642 + 0.002, lng: 127.0016 - 0.003 },
    schedules: [
      { id: 'm3-1', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
      { id: 'm3-2', title: '고객 미팅', date: '목요일 15:00', location: '강남 오피스' }
    ],
    original_index: 2, mt_gender: 1,
    mt_weather_sky: '4', mt_weather_tmx: 18 // 예시 날씨 정보
  }
];

// 지도 타입 정의 (기존 타입 정의 제거 및 서비스의 타입 사용)
type MapType = MapTypeService;

// 그룹멤버 타입 정의
interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: Location;
  schedules: Schedule[]; // Schedule 타입은 이 파일 내의 것을 사용
  mt_gender?: number | null;
  original_index: number;
  mt_weather_sky?: string | number | null;
  mt_weather_tmx?: string | number | null;
}

// 일정 타입 정의
interface Schedule {
  id: string; // sst_idx (Primary Key)
  sst_pidx?: number | null;
  memberId?: string | null; // mt_idx (프론트엔드에서 편의상 memberId로 사용)
  mt_schedule_idx?: number | null; // 새로 추가된 필드
  title?: string | null;    // sst_title
  date?: string | null;     // sst_sdate (datetime string)
  sst_edate?: string | null;  // (datetime string)
  sst_sedate?: string | null;
  sst_all_day?: AllDayCheckEnum | null;
  sst_repeat_json?: string | null;
  sst_repeat_json_v?: string | null;
  sgt_idx?: number | null;
  sgdt_idx?: number | null;
  sgdt_idx_t?: string | null;
  sst_alram?: number | null; // 실제 값에 따라 Enum 또는 number 타입 지정 가능
  sst_alram_t?: string | null;
  sst_adate?: string | null;   // (datetime string)
  slt_idx?: number | null;
  slt_idx_t?: string | null;
  location?: string | null; // sst_location_title (프론트엔드에서 편의상 location으로 사용)
  sst_location_add?: string | null;
  sst_location_lat?: number | null;  // Decimal이지만 프론트에서 number로 처리
  sst_location_long?: number | null; // Decimal이지만 프론트에서 number로 처리
  sst_supplies?: string | null;
  sst_memo?: string | null;
  sst_show?: ShowEnum | null;
  sst_location_alarm?: number | null; // 실제 값에 따라 Enum 또는 number 타입 지정 가능
  sst_schedule_alarm_chk?: ScheduleAlarmCheckEnum | null;
  sst_pick_type?: string | null;
  sst_pick_result?: number | null;
  sst_schedule_alarm?: string | null; // (datetime string)
  sst_update_chk?: string | null;
  sst_wdate?: string | null; // (datetime string)
  sst_udate?: string | null; // (datetime string)
  sst_ddate?: string | null; // (datetime string)
  sst_in_chk?: InCheckEnum | null;
  sst_schedule_chk?: ScheduleCheckEnum | null;
  sst_entry_cnt?: number | null;
  sst_exit_cnt?: number | null;
  statusDetail?: { // 스케줄 상태 상세 정보
    name: 'completed' | 'ongoing' | 'upcoming' | 'default';
    text: string;
    color: string;
    bgColor: string;
  };
}

// 전역 로더 인스턴스 생성 (싱글톤 패턴)
const googleMapsLoader = new Loader({
  apiKey: GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: ['places'],
  id: 'google-maps-script'
});

// API 로드 상태 추적을 위한 전역 객체
const apiLoadStatus = {
  google: false,
  naver: false
};

// CSS 애니메이션 키프레임 스타일 (최상단에 추가)
const modalAnimation = `
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
  z-index: 5;
}

.map-wrapper {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 60px; /* 헤더 높이만큼 아래에서 시작 */
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
}

/* Bottom Sheet 스타일 */
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* 0.4s와 0.2s delay → 0.5s로 변경하여 바텀시트와 동일하게 */
  z-index: 40;
  max-height: 90vh;
  /* overflow-y: auto; */ /* 제거 - 내부 컨텐츠 래퍼가 담당 */
  touch-action: pan-y; /* 시트 자체 드래그를 위함 */
  /* padding-bottom: 20px; */ /* 제거 - 내부 컨텐츠 래퍼가 담당 */
  will-change: transform;
}

.bottom-sheet-handle {
  width: 40px;
  height: 5px;
  background-color: #e2e8f0;
  border-radius: 3px;
  margin: 8px auto;
  cursor: grab;
}

.bottom-sheet-handle:active {
  cursor: grabbing;
}

.bottom-sheet-collapsed {
  transform: translateY(calc(100% - 100px));
  min-height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(68%);
  min-height: 100vh;
}

.bottom-sheet-expanded {
  transform: translateY(0%);
  height: 85vh; /* 고정 높이 추가 조정 (88vh -> 85vh) */
  overflow-y: hidden !important; /* 중요: 시트 자체는 스크롤되지 않음 */
  display: flex !important;
  flex-direction: column !important;
}

/* 맵 헤더 스타일 - 바텀시트 위치에 따라 이동하도록 수정 */
.map-header {
  position: fixed;
  left: 16px;
  right: auto;
  width: 60px;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.7); /* 어두운 배경색으로 변경 */
  color: white; /* 텍스트 색상을 흰색으로 변경 */
  padding: 6px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* opacity delay 제거, bottom과 동일 시간 */
  max-width: 60px;
}

.map-controls {
  position: fixed;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
              bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* visibility 제외하여 즉시 처리 */
}

/* 바텀시트 상태에 따른 헤더 위치 */
.header-collapsed {
  bottom: 120px; /* 바텀시트 높이(150px) + 간격(15px) */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.header-middle {
  bottom: calc(33vh + 10px); 
  top: auto;
  opacity: 1;
  visibility: visible;
}

.header-expanded {
  opacity: 0;
  visibility: hidden;
}

/* 컨트롤 버튼 위치 별도 관리 */
.controls-collapsed {
  bottom: 120px; /* 바텀시트 높이(150px) + 간격(15px) - 헤더와 동일한 위치 */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.controls-middle {
  bottom: calc(33vh + 10px); /* 바텀시트 중간 높이 + 간격(15px) - 헤더와 동일한 위치 */
  top: auto;
  opacity: 1;
  visibility: visible;
}

.controls-expanded {
  bottom: calc(33vh + 10px); /* middle 상태와 동일한 위치 유지 */
  opacity: 0;
  visibility: hidden;
  transition: none; /* 즉시 사라지도록 transition 제거 */
}

.map-control-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: #EEF2FF;
  transition: all 0.2s;
}

.map-control-button:hover {
  background-color: rgba(0, 0, 0, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.15);
}

/* 섹션 구분선 스타일 추가 */
.section-divider {
  height: 1px;
  background: #f2f2f2;
  margin: 16px 0;
  width: 100%;
}

.section-title {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #424242;
  font-weight: normal;
}

.content-section {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.content-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.members-section {
  background: linear-gradient(to right, rgba(22, 163, 74, 0.03), transparent); /* Indigo to Green gradient */
}

.members-section::before {
  background-color: #16A34A; /* Indigo (#4F46E5) to Green-600 (#16A34A) */
}

.schedule-section {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.03), transparent);
}

.schedule-section::before {
  background-color: #EC4899; /* 핑크 색상 */
}

.places-section {
  background: linear-gradient(to right, rgba(234, 179, 8, 0.03), transparent);
}

.places-section::before {
  background-color: #EAB308; /* 노란색 색상 */
}

/* 스크롤바 숨김 스타일 */
.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
`;

export const dynamic = 'force-dynamic';

const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/'; // 실제 백엔드 이미지 저장 경로의 기본 URL (★ 반드시 실제 경로로 수정 필요)

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const imageNumber = (index % 4) + 1; // index 기반으로 1~4 숫자 결정 (랜덤 대신)
  if (gender === 1) {
    return `/images/male_${imageNumber}.png`;
  } else if (gender === 2) {
    return `/images/female_${imageNumber}.png`;
  }
  // mt_gender가 없거나 1, 2가 아닐 때, avatar 이미지도 index 기반으로 일관성 유지
  return `/images/avatar${(index % 3) + 1}.png`; 
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

  // Bottom Sheet 상태 관리 추가 - 3단계로 확장 (접힘, 중간, 펼쳐짐)
  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'middle' | 'expanded'>('collapsed');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const dataFetchedRef = useRef({ members: false, schedules: false }); // dataFetchedRef를 객체로 변경

  const [initialWeatherLoaded, setInitialWeatherLoaded] = useState(false);
  const initialWeatherDataRef = useRef<WeatherInfo | null>(null); // 앱 초기/기본 날씨 저장용
  const [groupSchedules, setGroupSchedules] = useState<Schedule[]>([]); // 그룹 전체 스케줄 (memberId 포함)
  // const [dataFetched, setDataFetched] = useState({ members: false, schedules: false }); // 삭제
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false); // 첫번째 멤버 선택 완료 상태 추가

  // 그룹 관련 상태 추가
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [firstMemberSelected, setFirstMemberSelected] = useState(false); // 첫번째 멤버 선택 완료 추적

  // Bottom Sheet 상태를 클래스 이름으로 변환
  const getBottomSheetClassName = () => {
    // 로딩 중일 때는 강제로 collapsed 상태로 유지
    if (isMapLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) {
      return 'bottom-sheet-collapsed';
    }
    
    switch (bottomSheetState) {
      case 'collapsed': return 'bottom-sheet-collapsed';
      case 'middle': return 'bottom-sheet-middle';
      case 'expanded': return 'bottom-sheet-expanded';
      default: return 'bottom-sheet-collapsed';
    }
  };

  // Bottom Sheet 드래그 핸들러 수정 - 단순화된 로직
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startDragY.current = clientY;
    isDraggingRef.current = true;
    dragStartTime.current = Date.now();

    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current || startDragY.current === null) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - startDragY.current;
    
    // 최소 드래그 거리 체크 (30px 이상 움직여야 함)
    const minDragDistance = 30;
    if (Math.abs(deltaY) < minDragDistance) return;

    // 드래그 방향에 따라 다음 상태 결정
    let nextState: 'collapsed' | 'middle' | 'expanded' = bottomSheetState;
    
    if (deltaY < 0) { // 위로 드래그 (음수)
      if (bottomSheetState === 'collapsed') {
        nextState = 'middle';
      } else if (bottomSheetState === 'middle') {
        nextState = 'expanded';
      }
      // expanded에서 위로 드래그하면 그대로 유지
    } else { // 아래로 드래그 (양수)
      if (bottomSheetState === 'expanded') {
        nextState = 'middle';
      } else if (bottomSheetState === 'middle') {
        nextState = 'collapsed';
      }
      // collapsed에서 아래로 드래그하면 그대로 유지
    }

    // 상태가 변경되면 즉시 적용하고 드래그 종료
    if (nextState !== bottomSheetState) {
      console.log('[BOTTOM_SHEET] 드래그로 상태 변경:', bottomSheetState, '→', nextState);
      setBottomSheetState(nextState);
      
      // 드래그 종료 처리
      if (bottomSheetRef.current) {
        bottomSheetRef.current.style.transition = `transform ${BOTTOM_SHEET_POSITIONS.TRANSITION_DURATION} ${BOTTOM_SHEET_POSITIONS.TRANSITION_TIMING}`;
      }
      
      startDragY.current = null;
      isDraggingRef.current = false;
      dragStartTime.current = null;
    }
  };

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    
    if (!isDraggingRef.current || startDragY.current === null) return;

    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaY = clientY - startDragY.current;
    const deltaTime = dragStartTime.current ? Date.now() - dragStartTime.current : 0;
    
    // 드래그가 아닌 탭 동작인 경우 (짧은 시간 + 작은 움직임)
    const isTap = Math.abs(deltaY) < 10 && deltaTime < 200;
    
    if (isTap) {
      // 탭 동작: 다음 단계로 이동
      let nextState: 'collapsed' | 'middle' | 'expanded' = bottomSheetState;
      
      if (bottomSheetState === 'collapsed') {
        nextState = 'middle';
      } else if (bottomSheetState === 'middle') {
        nextState = 'expanded';
      }
      // expanded에서 탭하면 그대로 유지
      
      console.log('[BOTTOM_SHEET] 탭으로 상태 변경:', bottomSheetState, '→', nextState);
      setBottomSheetState(nextState);
    }

    // 스타일 복원
    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = `transform ${BOTTOM_SHEET_POSITIONS.TRANSITION_DURATION} ${BOTTOM_SHEET_POSITIONS.TRANSITION_TIMING}`;
    }

    startDragY.current = null;
    isDraggingRef.current = false;
    dragStartTime.current = null;
  };

  const toggleBottomSheet = () => {
    setBottomSheetState(prev => {
      const next = prev === 'collapsed' ? 'middle' : prev === 'middle' ? 'expanded' : 'collapsed';
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
                  lat: parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
                  lng: parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
                },
                schedules: [], 
                mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
                original_index: index,
                mt_weather_sky: member.mt_weather_sky,
                mt_weather_tmx: member.mt_weather_tmx
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
          const rawSchedules: Schedule[] = await scheduleService.getGroupSchedules(groupIdToUse, 7); 
          if (isMounted) {
            if (rawSchedules && rawSchedules.length > 0) {
              setGroupSchedules(rawSchedules); 
              setGroupMembers(prevMembers =>
                prevMembers.map(member => ({
                  ...member,
                  schedules: rawSchedules
                    .filter((schedule: Schedule) => 
                      schedule.mt_schedule_idx !== null && 
                      schedule.mt_schedule_idx !== undefined && 
                      String(schedule.mt_schedule_idx) === member.id
                    ) 
                }))
              );
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              setFilteredSchedules(
                rawSchedules.filter((s: Schedule) => s.date && s.date.startsWith(todayStr))
              );
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
  useEffect(() => {
    fetchUserGroups();
  }, []);

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
    const naverMapUrl = new URL(`https://openapi.map.naver.com/openapi/v3/maps.js`);
    naverMapUrl.searchParams.append('ncpClientId', NAVER_MAPS_CLIENT_ID);
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
    // 기존 스케줄 마커 삭제
    if (scheduleMarkersRef.current.length > 0) {
      scheduleMarkersRef.current.forEach(marker => {
        if (marker && marker.setMap) { // Naver, Google 마커 모두 setMap 메소드를 가짐
          marker.setMap(null);
        }
      });
      scheduleMarkersRef.current = [];
    }

    // 새 스케줄 마커 추가 - createMarker 함수 사용
    schedules.forEach((schedule, index) => {
      if (schedule.sst_location_lat && schedule.sst_location_long) {
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
        }
      }
    });
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
    
    // 첫번째 멤버 선택 완료 상태 설정
    if (!isFirstMemberSelectionComplete && selectedMember) {
      setIsFirstMemberSelectionComplete(true);
      console.log('[HOME] 첫번째 멤버 선택 완료:', selectedMember.name);
    }
    
    if (selectedMember) {
      setTodayWeather(getWeatherDisplayData(String(selectedMember.mt_weather_sky ?? 'default'), selectedMember.mt_weather_tmx));
      setFilteredSchedules(
        selectedMember.schedules.filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(selectedDate))
      );
    } else {
      if (initialWeatherDataRef.current) setTodayWeather(initialWeatherDataRef.current);
      setFilteredSchedules(
        groupSchedules
          .filter(s => typeof s.date === 'string' && s.date!.startsWith(selectedDate))
          .map(({memberId, ...rest}) => rest)
      );
    }
    updateMemberMarkers(updatedMembers);
  };

  // 선택된 날짜 변경 핸들러 (filteredSchedules 업데이트)
  const handleDateSelect = (dateValue: string) => {
    setSelectedDate(dateValue);
    const selectedMember = groupMembers.find(member => member.isSelected);
    if (selectedMember) {
      setFilteredSchedules(
        selectedMember.schedules.filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(dateValue))
      );
    } else {
      setFilteredSchedules(
        groupSchedules
          .filter(schedule => typeof schedule.date === 'string' && schedule.date!.startsWith(dateValue))
          .map(({memberId, ...rest}) => rest)
      );
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
            const photoForMarker = member.photo ?? getDefaultImage(member.mt_gender, member.original_index);
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
            const photoForMarker = member.photo ?? getDefaultImage(member.mt_gender, member.original_index);
            
            const markerInstance = new window.google.maps.Marker({
              position: { lat, lng },
              map: map.current,
              title: member.name,
              icon: {
                url: photoForMarker,
                scaledSize: new window.google.maps.Size(32, 32),
                origin: new window.google.maps.Point(0, 0),
                anchor: new window.google.maps.Point(16, 16)
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

  // 다음 7일 가져오기 (수정됨 - baseDate 인자 추가)
  const getNext7Days = (baseDate: Date) => {
    return Array.from({ length: 7 }, (_, i) => { // length를 7로 수정
      const date = addDays(baseDate, i);
      return {
        value: format(date, 'yyyy-MM-dd'),
        display: i === 0 ? '오늘' : format(date, 'MM.dd (E)', { locale: ko })
      };
    });
  };

  // useEffect를 사용하여 클라이언트 사이드에서 날짜 관련 상태 초기화
  useEffect(() => {
    const today = new Date();
    setSelectedDate(format(today, 'yyyy-MM-dd'));
    setDaysForCalendar(getNext7Days(today));
  }, []); // 빈 배열로 전달하여 마운트 시 1회 실행

  // 거리 포맷팅 함수
  const formatDistance = (km: number) => {
    return km < 1 ? `${(km * 1000).toFixed(0)}m` : `${km.toFixed(1)}km`;
  };

  // 헤더와 컨트롤 버튼의 클래스를 상태에 따라 결정하는 함수 수정
  const getHeaderClassName = () => {
    switch (bottomSheetState) {
      case 'collapsed': return 'header-collapsed';
      case 'middle': return 'header-middle';
      case 'expanded': return 'header-expanded';
      default: return 'header-collapsed';
    }
  };

  // 컨트롤 버튼 클래스 별도 관리
  const getControlsClassName = () => {
    switch (bottomSheetState) {
      case 'collapsed': return 'controls-collapsed';
      case 'middle': return 'controls-middle';
      case 'expanded': return 'controls-expanded';
      default: return 'controls-collapsed';
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
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 실패:', error);
      setUserGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // 그룹 선택 핸들러 - location/page.tsx와 동일한 패턴으로 수정
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 바텀시트를 collapsed 상태로 변경
    setBottomSheetState('collapsed');
    
    // 기존 데이터 초기화 - location/page.tsx와 동일한 패턴
    setGroupMembers([]);
    setGroupSchedules([]);
    setFilteredSchedules([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
    dataFetchedRef.current = { members: false, schedules: false };
    
    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');
  };

  // 그룹 선택 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isGroupSelectorOpen) {
        const target = event.target as HTMLElement;
        const groupDropdown = target.closest('.relative');
        const isGroupDropdownClick = groupDropdown && groupDropdown.querySelector('button[data-group-selector]');
        
        if (!isGroupDropdownClick) {
          setIsGroupSelectorOpen(false);
        }
      }
    };

    if (isGroupSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
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

  return (
    <>
      <style jsx global>{modalAnimation}</style>
      <PageContainer title="홈" showTitle={false} showBackButton={false} showHeader={false} className="p-0 m-0 w-full h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        {/* 지도 영역 (화면 100% 차지, fixed 포지션으로 고정) */}
        <div className="full-map-container">
          {/* 전체화면 로딩 - 지도 로딩, 그룹멤버 로딩, 첫번째 멤버 선택 완료까지 */}
          {(isMapLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
            <LoadingSpinner 
              message={
                isMapLoading 
                  ? "지도를 불러오는 중입니다..." 
                  : !dataFetchedRef.current.members 
                    ? "데이터를 불러오는 중입니다..."
                    : !dataFetchedRef.current.schedules
                      ? "그룹 일정을 불러오는 중입니다..."
                      : "첫번째 멤버 위치로 이동 중입니다..."
              } 
              fullScreen={true}
              type="ripple"
              size="md"
              color="indigo"
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

        {/* 지도 헤더 - 바텀시트 상태에 따라 위치 변경 */}
        {!(isMapLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <div className={`map-header ${getHeaderClassName()}`}>
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
        {!(isMapLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <div className={`map-controls ${getControlsClassName()}`}>
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
        {!(isMapLoading || !dataFetchedRef.current.members || !dataFetchedRef.current.schedules || !isFirstMemberSelectionComplete) && (
          <div 
            ref={bottomSheetRef}
            className={`bottom-sheet ${getBottomSheetClassName()}`}
            style={{ touchAction: 'pan-x' }} // 좌우 스와이프만 허용
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <div className="bottom-sheet-handle"></div>

            {/* 메인 컨텐츠 래퍼: 상태에 따라 패딩 및 스크롤 동작 변경 */}
            <div 
              className={`
                w-full
                ${bottomSheetState === 'expanded' 
                  ? 'flex flex-col flex-grow min-h-0'  // expanded: flex 레이아웃, 내부 스크롤 준비
                  : 'px-4 pb-8 overflow-y-auto h-full' // non-expanded: 자체 스크롤, 기존 패딩
                }
              `}
              style={bottomSheetState !== 'expanded' 
                ? { WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } // non-expanded: 터치 스크롤 활성화
                : {}
              }
            >
              {/* 그룹 멤버 (최상단으로 이동) */}
              <div className={`
                content-section members-section 
                min-h-[180px] max-h-[180px] overflow-y-auto /* 자체 콘텐츠가 많을 경우 스크롤 */
                ${bottomSheetState === 'expanded' 
                  ? 'flex-shrink-0 mx-4 mt-2 mb-3' // expanded: flex 아이템으로 동작, 위아래 마진
                  : 'mb-3 sm:mb-0' // non-expanded: 일반 블록 요소, 하단 마진 (좌우 패딩은 부모에서)
                }
              `}
              // non-expanded 상태에서 멤버 섹션 내부 스크롤을 원활하게 하기 위함
              style={bottomSheetState !== 'expanded' ? { touchAction: 'auto' } : {}} 
              onClick={bottomSheetState !== 'expanded' ? (e) => e.stopPropagation() : undefined}
              >
                <h2 className="text-lg text-gray-900 flex justify-between items-center section-title">
                  <div className="flex items-center space-x-3">
                    <span>그룹 멤버</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* 그룹 선택 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsGroupSelectorOpen(!isGroupSelectorOpen);
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                        disabled={isLoadingGroups}
                        data-group-selector="true"
                      >
                        <span className="truncate text-gray-700">
                          {isLoadingGroups 
                            ? '로딩 중...' 
                            : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                          }
                        </span>
                        <div className="ml-1 flex-shrink-0">
                          {isLoadingGroups ? (
                            <FiLoader className="animate-spin h-3 w-3 text-gray-400" />
                          ) : (
                            <FiChevronDown className={`text-gray-400 transition-transform duration-200 h-3 w-3 ${isGroupSelectorOpen ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>

                      {isGroupSelectorOpen && userGroups.length > 0 && (
                        <div className="absolute top-full right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto min-w-[160px]">
                          {userGroups.map((group) => (
                            <button
                              key={group.sgt_idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGroupSelect(group.sgt_idx);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 focus:outline-none focus:bg-indigo-50 ${
                                selectedGroupId === group.sgt_idx 
                                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                                  : 'text-gray-900'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">{group.sgt_title || `그룹 ${group.sgt_idx}`}</span>
                                {selectedGroupId === group.sgt_idx && (
                                  <span className="text-indigo-500 ml-2">✓</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link 
                      href="/group" 
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                      그룹 관리
                    </Link>
                  </div>
                </h2>
                {groupMembers.length > 0 ? (
                  <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-2">
                    {groupMembers.map((member, index) => ( // 이 index는 groupMembers 배열 내에서의 index임
                      <div key={member.id} className="flex flex-col items-center p-0 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMemberSelect(member.id);
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          className={`flex flex-col items-center`}
                        >
                          <div className={`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${
                            member.isSelected ? 'border-indigo-500 ring-2 ring-indigo-300 scale-110' : 'border-transparent'
                          }`}>
                            <img 
                              src={member.photo ?? getDefaultImage(member.mt_gender, member.original_index)} // original_index 사용
                              alt={member.name} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getDefaultImage(member.mt_gender, member.original_index); // original_index 사용
                                target.onerror = null; // 무한 루프 방지
                              }}
                            />
                          </div>
                          <span className={`block text-xs font-medium mt-1 ${
                            member.isSelected ? 'text-indigo-700' : 'text-gray-900'
                          }`}>
                            {member.name}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-500">
                    <p>그룹에 참여한 멤버가 없습니다</p>
                  </div>
                )}
              </div>

              {/* 스크롤 가능한 콘텐츠 영역 (오늘의 일정, 추천 장소) */}
              <div className={`
                ${bottomSheetState === 'expanded' 
                  ? 'flex-grow min-h-0 overflow-y-auto hide-scrollbar px-4 pb-16' // expanded: 남은 공간 채우고 내부 스크롤, pb-4 -> pb-16
                  : '' // non-expanded: 일반 플로우 (부모 div가 스크롤 담당)
                }
              `}
              style={bottomSheetState === 'expanded' 
                ? { WebkitOverflowScrolling: 'touch', touchAction: 'auto' } // expanded: 터치 스크롤 활성화
                : {}
              }
              onClick={bottomSheetState === 'expanded' ? (e) => e.stopPropagation() : undefined}
              >
                {/* 오늘의 일정 - 선택된 멤버의 일정을 표시 */}
                <div className={`content-section schedule-section ${bottomSheetState !== 'expanded' ? '' : 'mt-0'}`}>
                  <h2 className="text-lg text-gray-900 flex justify-between items-center section-title">
                    {groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 일정` : '오늘의 일정'}
                    {
                      groupMembers.some(m => m.isSelected) ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const selectedMember = groupMembers.find(m => m.isSelected);
                            if (selectedMember) {
                              router.push(`/schedule/add?memberId=${selectedMember.id}&memberName=${selectedMember.name}&from=home`);
                            }
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          일정 추가
                        </button>
                      ) : (
                        <Link href="/schedule" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center">
                          더보기
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </Link>
                      )
                    }
                  </h2>
                  <div className="mb-3 overflow-x-auto pb-2 hide-scrollbar">
                    <div className="flex space-x-2">
                      {daysForCalendar.map((day, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDateSelect(day.value);
                          }}
                          className={`px-3 py-2 rounded-lg flex-shrink-0 focus:outline-none transition-colors ${
                            selectedDate === day.value
                              ? 'bg-gray-900 text-white font-medium shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">{day.display}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {filteredSchedules.length > 0 ? (
                    <ul className="space-y-3">
                      {filteredSchedules.map((schedule) => {
                        // 시간 포맷팅 (12시간제, 오전/오후)
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

                        return (
                          <li key={schedule.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors relative"> {/* relative 추가 */}
                            <Link href={`/schedule/${schedule.id}`} className="block"> 
                              <h3 className="font-medium text-gray-900 text-base mb-1">{schedule.title}</h3> 
                              
                              <div className="flex items-center text-sm text-gray-700 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                <span className="text-gray-600">{formattedTime}</span> {/* 시간 텍스트 색상 변경 */}
                              </div>

                              {displayLocation && (
                                <div className="text-sm flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  </svg>
                                  <span className="text-gray-500">{displayLocation}</span> {/* 장소 텍스트 색상 변경 */}
                              </div>
                              )}
                              
                              {/* 오른쪽 화살표 아이콘 */}
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                              </div>
                          </Link>
                        </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                      <p>{groupMembers.some(m => m.isSelected) ? '선택한 멤버의 일정이 없습니다' : '오늘 일정이 없습니다'}</p>
                    </div>
                  )}
                </div>

                {/* 확장됐을 때만 표시되는 나머지 내용 */}
                <div className={`transition-all duration-300 ${bottomSheetState === 'expanded' ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {/* 추천 장소 */}
                  <div className={`content-section places-section ${bottomSheetState === 'expanded' ? 'mt-3 mb-2' : 'mb-12'}`}>
                    <h2 className="text-lg text-gray-900 flex justify-between items-center section-title">
                      내 주변 장소
                      <Link 
                        href="/location/nearby" 
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        더보기
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </h2>
                    {recommendedPlaces.length > 0 ? (
                      <ul className="space-y-3">
                        {recommendedPlaces.map((place) => (
                          <li key={place.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                            <Link href={`/location/place/${place.id}`} className="block">
                              <div className="flex justify-between">
                                <h3 className="font-medium text-gray-900">{place.title}</h3>
                                <span className="text-sm text-indigo-600 font-medium">
                                  {formatDistance(place.distance)}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                <div className="inline-flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  </svg>
                                  {place.address}
                                </div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-3 text-gray-500">주변 장소가 없습니다</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
} 