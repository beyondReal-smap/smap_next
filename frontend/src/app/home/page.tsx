'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Card, Button } from '../components/layout';
import { Loader } from '@googlemaps/js-api-loader';
// 공통 설정 및 서비스 임포트
import config, { API_KEYS, detectLanguage, MAP_CONFIG } from '../../config';
import mapService, { 
  MapType as MapTypeService, 
  MAP_API_KEYS, 
  Location, 
  cleanupGoogleMap, 
  cleanupNaverMap 
} from '../../services/mapService';

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
const MOCK_GROUP_MEMBERS = [
  { 
    id: '1', 
    name: '김철수', 
    photo: '/images/avatar3.png', 
    isSelected: false,
    location: { lat: 37.5642 + 0.005, lng: 127.0016 + 0.002 },
    schedules: [
      { id: 'm1-1', title: '팀 회의', date: '오늘 14:00', location: '강남 사무실' },
      { id: 'm1-2', title: '저녁 약속', date: '오늘 19:00', location: '이탈리안 레스토랑' }
    ]
  },
  { 
    id: '2', 
    name: '이영희', 
    photo: '/images/avatar1.png', 
    isSelected: false,
    location: { lat: 37.5642 - 0.003, lng: 127.0016 - 0.005 },
    schedules: [
      { id: 'm2-1', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' }
    ]
  },
  { 
    id: '3', 
    name: '박민수', 
    photo: '/images/avatar2.png', 
    isSelected: false,
    location: { lat: 37.5642 + 0.002, lng: 127.0016 - 0.003 },
    schedules: [
      { id: 'm3-1', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
      { id: 'm3-2', title: '고객 미팅', date: '목요일 15:00', location: '강남 오피스' }
    ]
  }
];

// 지도 타입 정의 (기존 타입 정의 제거 및 서비스의 타입 사용)
type MapType = MapTypeService;

// 그룹멤버 타입 정의
interface GroupMember {
  id: string;
  name: string;
  photo: string;
  isSelected: boolean;
  location: Location;
  schedules: Schedule[];
}

// 일정 타입 정의
interface Schedule {
  id: string;
  title: string;
  date: string;
  location: string;
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
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 40;
  max-height: 90vh;
  overflow-y: auto;
  touch-action: pan-y;
  padding-bottom: 20px;
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
  height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(65%);
  height: 100vh;
}

.bottom-sheet-expanded {
  transform: translateY(0%);
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 60px;
}

.map-controls {
  position: fixed;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 바텀시트 상태에 따른 헤더 위치 */
.header-collapsed {
  bottom: 120px; /* 바텀시트 높이(150px) + 간격(15px) */
  top: auto;
  opacity: 1;
}

.header-middle {
  bottom: calc(33vh + 10px); 
  top: auto;
  opacity: 1;
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
}

.controls-middle {
  bottom: calc(33vh + 10px); /* 바텀시트 중간 높이 + 간격(15px) - 헤더와 동일한 위치 */
  top: auto;
  opacity: 1;
}

.controls-expanded {
  opacity: 0;
  visibility: hidden;
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

export default function HomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('사용자');
  const [userLocation, setUserLocation] = useState<Location>({ lat: 37.5642, lng: 127.0016 }); // 기본: 서울
  const [locationName, setLocationName] = useState('서울시');
  const [recommendedPlaces, setRecommendedPlaces] = useState(RECOMMENDED_PLACES);
  const [recentSchedules, setRecentSchedules] = useState([
    { id: '1', title: '팀 미팅', date: '오늘 14:00', location: '강남 사무실' },
    { id: '2', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' },
    { id: '3', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
  ]);
  const [favoriteLocations, setFavoriteLocations] = useState([
    { id: '1', name: '회사', address: '서울시 강남구 테헤란로 123' },
    { id: '2', name: '자주 가는 카페', address: '서울시 강남구 역삼동 234' },
  ]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(MOCK_GROUP_MEMBERS);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(''); // 초기값을 빈 문자열로 변경
  const [todayWeather, setTodayWeather] = useState({ temp: '22°C', condition: '맑음', icon: '☀️' });
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [mapType, setMapType] = useState<MapType>('naver'); // 기본값을 네이버 지도로 변경
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
  
  // 스크립트 로드 및 지도 초기화 상태 추적
  const [mapsInitialized, setMapsInitialized] = useState({
    google: false,
    naver: false
  });

  // Bottom Sheet 상태 관리 추가 - 3단계로 확장 (접힘, 중간, 펼쳐짐)
  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'middle' | 'expanded'>('collapsed');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const currentDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const initialScrollTopRef = useRef<number>(0);

  // Bottom Sheet 상태를 클래스 이름으로 변환
  const getBottomSheetClassName = () => {
    switch (bottomSheetState) {
      case 'collapsed': return 'bottom-sheet-collapsed';
      case 'middle': return 'bottom-sheet-middle';
      case 'expanded': return 'bottom-sheet-expanded';
      default: return 'bottom-sheet-collapsed';
    }
  };

  // Bottom Sheet 드래그 핸들러 수정
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startDragY.current = clientY;
    currentDragY.current = clientY;
    dragStartTime.current = Date.now();
    isDraggingRef.current = true;
    initialScrollTopRef.current = bottomSheetRef.current?.scrollTop || 0;

    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = 'none';
      
      const mapHeader = document.querySelector('.map-header') as HTMLElement;
      const mapControls = document.querySelector('.map-controls') as HTMLElement;
      
      if (mapHeader) {
        mapHeader.style.transition = 'none';
      }
      
      if (mapControls) {
        mapControls.style.transition = 'none';
      }
    }
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (startDragY.current === null || !bottomSheetRef.current || currentDragY.current === null) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - currentDragY.current;
    
    if (Math.abs(deltaY) > 5) {
      currentDragY.current = clientY;
      const currentTransform = getComputedStyle(bottomSheetRef.current).transform;
      let currentTranslateY = 0;
      if (currentTransform !== 'none') {
        const matrix = new DOMMatrixReadOnly(currentTransform);
        currentTranslateY = matrix.m42;
      }
      let newTranslateY = currentTranslateY + deltaY;
      const expandedY = 0;
      const collapsedY = window.innerHeight * 0.6;
      newTranslateY = Math.max(expandedY - (window.innerHeight * 0.1), Math.min(newTranslateY, collapsedY + 50));
      bottomSheetRef.current.style.transform = `translateY(${newTranslateY}px)`;
      bottomSheetRef.current.style.transition = 'none';
    }
  };

  // 드래그 종료 핸들러 수정
  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (startDragY.current === null || !bottomSheetRef.current || currentDragY.current === null) return;

    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaYOverall = clientY - startDragY.current;
    const deltaTime = dragStartTime.current ? Date.now() - dragStartTime.current : 0;
    
    const isDrag = Math.abs(deltaYOverall) > 10 || deltaTime > 200;

    if (isDrag) {
      bottomSheetRef.current.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      const velocity = deltaTime > 0 ? deltaYOverall / deltaTime : 0;
      const currentTransform = getComputedStyle(bottomSheetRef.current).transform;
      let currentSheetY = 0;
      if (currentTransform !== 'none') {
        const matrix = new DOMMatrixReadOnly(currentTransform);
        currentSheetY = matrix.m42;
      }
      const windowHeight = window.innerHeight;
      const upperThreshold = windowHeight * 0.2;  // 상단 20%
      const middleThreshold = windowHeight * 0.5;  // 중간 50%

      let finalState: 'expanded' | 'middle' | 'collapsed';
      
      if (Math.abs(velocity) > 0.5) {
        // 빠른 스와이프 동작 처리
        if (velocity < 0) {
          // 위로 스와이프
          finalState = currentSheetY < middleThreshold ? 'expanded' : 'middle';
        } else {
          // 아래로 스와이프
          finalState = currentSheetY > middleThreshold ? 'collapsed' : 'middle';
        }
      } else {
        // 일반적인 드래그 동작 처리
        if (currentSheetY < upperThreshold) {
          finalState = 'expanded';
        } else if (currentSheetY < middleThreshold) {
          finalState = 'middle';
        } else {
          finalState = 'collapsed';
        }
      }
      
      setBottomSheetState(finalState);
    }

    bottomSheetRef.current.style.transform = '';
    startDragY.current = null;
    currentDragY.current = null;
    dragStartTime.current = null;
  };

  const toggleBottomSheet = () => {
    setBottomSheetState(prev => {
      if (prev === 'collapsed') return 'middle';
      if (prev === 'middle') return 'expanded';
      return 'collapsed';
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

  // 컴포넌트 마운트 시 초기 지도 타입 설정
  useEffect(() => {
    // 네이버 지도를 기본으로 사용 (개발 환경에서도 네이버 지도 사용)
    setMapType('naver');
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
    // 지도가 초기화되면 첫 번째 멤버 선택
    if ((mapType === 'naver' && mapsInitialized.naver) || 
        (mapType === 'google' && mapsInitialized.google)) {
      if (groupMembers.length > 0) {
        console.log('지도 초기화 감지 - 첫 번째 멤버 선택:', groupMembers[0].name);
        
        const timerId = setTimeout(() => {
          handleMemberSelect(groupMembers[0].id);
        }, 500);
        
        return () => clearTimeout(timerId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsInitialized.naver, mapsInitialized.google, mapType]);

  // 그룹 멤버 선택 핸들러 수정 - 한 번에 한 명만 선택 가능하도록 변경
  const handleMemberSelect = (id: string) => {
    console.log('멤버 선택 실행:', id);
    
    // 멤버 선택 상태 업데이트 - 한 명만 선택되도록 수정
    const updatedMembers = groupMembers.map(member => 
      member.id === id 
        ? { ...member, isSelected: !member.isSelected } 
        : { ...member, isSelected: false }  // 다른 멤버는 모두 선택 해제
    );
    setGroupMembers(updatedMembers);
    
    // 선택된 멤버 찾기
    const selectedMember = updatedMembers.find(member => member.isSelected);
    
    // 선택된 멤버의 일정 또는 기본 일정 표시
    if (selectedMember) {
      setFilteredSchedules(selectedMember.schedules);
      console.log('선택된 멤버:', selectedMember.name, selectedMember.location);
    } else {
      // 선택된 멤버가 없으면 기본 일정 표시
      setFilteredSchedules(recentSchedules);
    }
    
    // 지도에 선택된 멤버 마커 표시
    updateMemberMarkers(updatedMembers);
  };

  // 멤버 마커 업데이트 함수
  const updateMemberMarkers = (members: GroupMember[]) => {
    // 기존 마커 삭제
    if (memberMarkers.current.length > 0) {
      memberMarkers.current.forEach(marker => {
        if (mapType === 'naver' && naverMap.current) {
          marker.setMap(null);
        } else if (mapType === 'google' && map.current) {
          marker.setMap(null);
        }
      });
      memberMarkers.current = [];
    }
    
    // 선택된 멤버 마커 추가
    const selectedMembers = members.filter(member => member.isSelected);
    
    if (selectedMembers.length > 0) {
      selectedMembers.forEach(member => {
        if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
          // 네이버 지도 마커
          const marker = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(member.location.lat, member.location.lng),
            map: naverMap.current,
            icon: {
              content: `
                <div style="position: relative; text-align: center;">
                  <div style="width: 40px; height: 40px; background-color: white; border: 2px solid #4F46E5; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <img src="${member.photo}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>
                  <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background-color:rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px;">
                    ${member.name}
                  </div>
                </div>
              `,
              size: new window.naver.maps.Size(40, 40),
              anchor: new window.naver.maps.Point(20, 20)
            }
          });
          memberMarkers.current.push(marker);
        } else if (mapType === 'google' && map.current && googleMapsLoaded) {
          // 구글 지도 마커
          const marker = new window.google.maps.Marker({
            position: member.location,
            map: map.current,
            title: member.name,
            icon: {
              url: member.photo,
              scaledSize: new window.google.maps.Size(40, 40),
              origin: new window.google.maps.Point(0, 0),
              anchor: new window.google.maps.Point(20, 20),
              labelOrigin: new window.google.maps.Point(20, 50)
            },
            label: {
              text: member.name,
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              background: '#4F46E5',
              padding: '4px 8px',
              borderRadius: '4px'
            }
          });
          memberMarkers.current.push(marker);
        }
      });
      
      // 선택된 멤버 위치로 지도 이동 (항상 수행되도록 수정)
      if (selectedMembers.length === 1) {
        const selectedMember = selectedMembers[0];
        
        if (mapType === 'naver' && naverMap.current && naverMapsLoaded) {
          // 네이버 지도 이동 및 줌 레벨 조정
          naverMap.current.setCenter(new window.naver.maps.LatLng(selectedMember.location.lat, selectedMember.location.lng));
          naverMap.current.setZoom(17); // 15에서 17로 수정
          console.log('네이버 지도 중심 이동:', selectedMember.name, selectedMember.location);
        } else if (mapType === 'google' && map.current && googleMapsLoaded) {
          // 구글 지도 이동 및 줌 레벨 조정
          map.current.panTo(selectedMember.location);
          map.current.setZoom(17); // 15에서 17로 수정
          console.log('구글 지도 중심 이동:', selectedMember.name, selectedMember.location);
        }
      } else if (selectedMembers.length > 1) {
        // 여러 멤버가 선택된 경우 모든 마커가 보이도록 지도 조정
        if (mapType === 'naver' && naverMap.current) {
          const bounds = new window.naver.maps.LatLngBounds();
          selectedMembers.forEach(member => {
            bounds.extend(new window.naver.maps.LatLng(member.location.lat, member.location.lng));
          });
          naverMap.current.fitBounds(bounds);
        } else if (mapType === 'google' && map.current) {
          const bounds = new window.google.maps.LatLngBounds();
          selectedMembers.forEach(member => {
            bounds.extend(member.location);
          });
          map.current.fitBounds(bounds);
        }
      }
    }
  };

  // 선택된 날짜 변경 핸들러
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // 실제 구현 시에는 해당 날짜의 일정 및 위치 데이터를 불러옵니다
  };

  // 초기 실행 시 일정 필터링 설정
  useEffect(() => {
    setFilteredSchedules(recentSchedules);
  }, [recentSchedules]);

  // 지도 타입 변경 시 멤버 마커 업데이트
  useEffect(() => {
    if (
      (mapType === 'naver' && naverMapsLoaded && naverMap.current) || 
      (mapType === 'google' && googleMapsLoaded && map.current)
    ) {
      updateMemberMarkers(groupMembers);
    }
  }, [mapType, naverMapsLoaded, googleMapsLoaded]);

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

  return (
    <>
      <style jsx global>{modalAnimation}</style>
      <PageContainer title="홈" showTitle={false} showBackButton={false} showHeader={false} className="p-0 m-0 w-full h-screen">
        {/* 지도 영역 (화면 100% 차지, fixed 포지션으로 고정) */}
        <div className="full-map-container">
          {/* 지도 컨테이너 */}
          {isMapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
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
        
        {/* 지도 컨트롤 버튼들 - 바텀시트 상태에 따라 위치 변경 */}
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

        {/* Bottom Sheet - 끌어올리거나 내릴 수 있는 패널 */}
        <div 
          ref={bottomSheetRef}
          className={`bottom-sheet ${getBottomSheetClassName()}`}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div className="bottom-sheet-handle"></div>
          <div className="px-4 pb-8" onClick={(e) => e.stopPropagation()}>
            {/* 그룹 멤버 (최상단으로 이동) */}
            <div className="content-section members-section">
              <h2 className="text-lg text-gray-900 flex justify-between items-center section-title">
                그룹 멤버
                <Link 
                  href="/group" 
                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  그룹 관리
                </Link>
              </h2>
              {groupMembers.length > 0 ? (
                <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex flex-col items-center p-0 flex-shrink-0">
                      <button
                        onClick={() => handleMemberSelect(member.id)}
                        className={`flex flex-col items-center`}
                      >
                        <div className={`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-transform duration-200 ${
                          member.isSelected ? 'border-indigo-500' : 'border-transparent'
                        }`}>
                          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
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

            {/* 오늘의 일정 - 선택된 멤버의 일정을 표시 */}
            <div className="content-section schedule-section">
              <h2 className="text-lg text-gray-900 flex justify-between items-center section-title">
                {groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 일정` : '오늘의 일정'}
                {
                  groupMembers.some(m => m.isSelected) ? (
                    <button 
                      onClick={() => {
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
                      onClick={() => handleDateSelect(day.value)}
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
                  {filteredSchedules.map((schedule) => (
                    <li key={schedule.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Link href={`/schedule/${schedule.id}`} className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-gray-900">{schedule.title}</h3>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="inline-flex items-center mr-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {schedule.date}
                            </span>
                            <span className="inline-flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {schedule.location}
                            </span>
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
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
              <div className="content-section places-section mb-12">
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
      </PageContainer>
    </>
  );
} 