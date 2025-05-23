'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// import mapboxgl from 'mapbox-gl'; // Mapbox 임포트 제거
// import 'mapbox-gl/dist/mapbox-gl.css'; // Mapbox CSS 제거
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiMapPin, FiChevronUp, FiChevronDown, FiX, FiLoader, FiBell, FiBellOff } from 'react-icons/fi'; // Added FiBell, FiBellOff
import { FaSearch as FaSearchSolid } from 'react-icons/fa'; // 주소 검색 아이콘 추가
import { toast, ToastContainer } from 'react-toastify'; // react-toastify 임포트
import 'react-toastify/dist/ReactToastify.css'; // react-toastify CSS 임포트
import Link from 'next/link'; // Link 임포트 추가
// API_KEYS와 MAP_CONFIG를 config에서 가져오도록 수정
import { API_KEYS, MAP_CONFIG, KAKAO_SHARE } from '../../config'; 
import { PageContainer, Button } from '../components/layout'; // Button 컴포넌트 경로 복원
import ReactDOM from 'react-dom'; // Portal 사용 위해 추가
import memberService from '@/services/memberService'; // 멤버 서비스 추가
import locationService, { OtherMemberLocationRaw } from '@/services/locationService'; // locationService 임포트 추가

// window 전역 객체에 naver 프로퍼티 타입 선언 (home/page.tsx 참고)
declare global {
  interface Window {
    naver: any;
  }
}

// NAVER_MAPS_CLIENT_ID를 API_KEYS에서 가져오도록 수정
const NAVER_MAPS_CLIENT_ID = API_KEYS.NAVER_MAPS_CLIENT_ID;
// KAKAO_REST_API_KEY를 API_KEYS.KAKAO_REST_API_KEY에서 가져오도록 수정
const KAKAO_REST_API_KEY = API_KEYS.KAKAO_REST_API_KEY; 
// 백엔드 스토리지 URL 상수 추가
const BACKEND_STORAGE_BASE_URL = 'https://118.67.130.71:8000/storage/';

// 기본 이미지 가져오는 함수 추가
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const imageNumber = (index % 4) + 1; // index 기반으로 1~4 숫자 결정
  if (gender === 1) {
    return `/images/male_${imageNumber}.png`;
  } else if (gender === 2) {
    return `/images/female_${imageNumber}.png`;
  }
  // mt_gender가 없거나 1, 2가 아닐 때, avatar 이미지도 index 기반으로 일관성 유지
  return `/images/avatar${(index % 3) + 1}.png`; 
};

// LocationData 인터페이스 정의
interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  memo: string;
  favorite: boolean;
  notifications?: boolean; // Added notifications field
}

// NewLocationInput 인터페이스 정의 (id가 optional)
interface NewLocationInput {
  id?: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  category?: string;
  memo?: string;
  favorite?: boolean;
  notifications?: boolean; // Added notifications field
}

// MOCK_LOCATIONS 정의 복원 (기존 파일 내용 참고)
const MOCK_LOCATIONS: LocationData[] = [
  {
    id: '1',
    name: '본사 사무실',
    address: '서울시 강남구 테헤란로 123',
    category: '회사',
    coordinates: [127.0381, 37.5012], 
    memo: '본사 사무실 위치입니다.',
    favorite: true,
    notifications: false, // Added
  },
  {
    id: '2',
    name: '강남역 미팅룸',
    address: '서울시 강남구 강남대로 456',
    category: '미팅장소',
    coordinates: [127.0281, 37.4982],
    memo: '주요 미팅 장소',
    favorite: false,
    notifications: true, // Added
  },
  {
    id: '3',
    name: '을지로 지사',
    address: '서울시 중구 을지로 789',
    category: '회사',
    coordinates: [126.9981, 37.5662],
    memo: '을지로 지사 위치',
    favorite: true,
    notifications: false, // Added
  }
];

// --- home/page.tsx에서 가져온 인터페이스 및 데이터 ---
interface HomeLocation { // 이름 충돌 방지를 위해 HomeLocation으로 변경
  lat: number;
  lng: number;
}

interface HomeSchedule { // 이름 충돌 방지를 위해 HomeSchedule로 변경
  id: string;
  title: string;
  date: string;
  location: string;
}

// GroupMember 인터페이스 수정
interface GroupMember {
  id: string;
  name: string;
  photo: string | null; // photo 타입을 string | null로 변경
  isSelected: boolean;
  location: HomeLocation;
  schedules: HomeSchedule[];
  savedLocations: LocationData[];
  mt_gender?: number | null; // mt_gender 필드 추가
  original_index: number;   // original_index 필드 추가
}

// MOCK_GROUP_MEMBERS 정의 (필요한 필드 추가)
const MOCK_GROUP_MEMBERS: GroupMember[] = [
  {
    id: '1',
    name: '김철수',
    photo: '/images/avatar3.png',
    isSelected: false,
    location: { lat: 37.5012 + 0.005, lng: 127.0381 + 0.002 },
    schedules: [
      { id: 'm1-1', title: '팀 회의', date: '오늘 14:00', location: '강남 사무실' },
    ],
    savedLocations: [
      { id: 'loc1-1', name: '철수네 회사', address: '서울시 강남구 테헤란로 100', category: '회사', coordinates: [127.0350, 37.5000], memo: '철수 회사', favorite: true, notifications: false },
      { id: 'loc1-2', name: '철수 단골식당', address: '서울시 강남구 역삼동 101', category: '식당', coordinates: [127.0380, 37.5015], memo: '점심 맛집', favorite: false, notifications: true },
    ],
    mt_gender: 1, // 예시 성별
    original_index: 0 // 예시 인덱스
  },
  {
    id: '2',
    name: '이영희',
    photo: '/images/avatar1.png',
    isSelected: false,
    location: { lat: 37.4982 - 0.003, lng: 127.0281 - 0.005 },
    schedules: [
      { id: 'm2-1', title: '프로젝트 발표', date: '내일 10:00', location: '회의실 A' }
    ],
    savedLocations: [
      { id: 'loc2-1', name: '영희네 집', address: '서울시 서초구 반포동 200', category: '집', coordinates: [127.0010, 37.5100], memo: '영희 집', favorite: true, notifications: false },
      { id: 'loc2-2', name: '영희 헬스장', address: '서울시 서초구 잠원동 202', category: '운동', coordinates: [127.0090, 37.5120], memo: '운동하는 곳', favorite: false, notifications: false },
      { id: 'loc2-3', name: '영희 자주가는 카페', address: '서울시 강남구 신사동 203', category: '카페', coordinates: [127.0220, 37.5220], memo: '분위기 좋은 곳', favorite: false, notifications: true },
    ],
    mt_gender: 2,
    original_index: 1
  },
  {
    id: '3',
    name: '박민수',
    photo: '/images/avatar2.png',
    isSelected: false,
    location: { lat: 37.5662 + 0.002, lng: 126.9981 - 0.003 },
    schedules: [
      { id: 'm3-1', title: '주간 회의', date: '수요일 11:00', location: '본사 대회의실' },
    ],
    savedLocations: [
      { id: 'loc3-1', name: '민수 스터디룸', address: '서울시 종로구 관철동 300', category: '스터디', coordinates: [126.9850, 37.5690], memo: '그룹 스터디 장소', favorite: false, notifications: false },
    ],
    mt_gender: 1,
    original_index: 2
  }
];
// --- END: home/page.tsx에서 가져온 인터페이스 및 데이터 ---

const CATEGORY_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '회사', label: '회사' },
  { value: '미팅장소', label: '미팅장소' },
  { value: '식당', label: '식당' },
  { value: '카페', label: '카페' },
  { value: '기타', label: '기타' }
];

// Naver Maps 타입 별칭 (타입 오류 방지) - any 타입으로 임시 변경
type NaverMap = any; 
type NaverCoord = any;
type NaverMarker = any;
type NaverInfoWindow = any; 
type NaverService = any; 

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
  animation: slideUp 0.3s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
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
  z-index: 5;
}

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

.bottom-sheet-expanded {
  transform: translateY(62%); /* 58%에서 62%로 변경하여 10px 정도 덜 올라오도록 조정 */
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.hide-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.modal-overlay {
  z-index: 50;
}
.modal-content {
  z-index: 51;
}
.location-search-modal-overlay {
  z-index: 60; /* 주소 검색 모달이 다른 모달 위에 오도록 */
}
.location-search-modal-content {
  z-index: 61;
}
.location-info-panel {
  position: absolute;
  top: 80px; /* 헤더 아래 여백을 줄여서 더 위쪽으로 이동 */
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 30px);
  max-width: 480px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  z-index: 55; /* z-index를 높여서 바텀시트 위에 확실히 표시 */
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) scale(0.95);
  transition: opacity 0.3s ease-out, visibility 0.3s ease-out, transform 0.3s ease-out;
}
.location-info-panel.open {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
}
.address-search-results-in-panel {
  max-height: 150px; /* 패널 내 검색 결과 높이 제한 */
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-top: 8px;
}

/* --- home/page.tsx 에서 가져온 스타일 --- */
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
  background-color: #16A34A; /* Indigo-600 */
}

.places-section { /* Teal or other color */
  background: linear-gradient(to right, rgba(236, 72, 153, 0.03), transparent);
  margin-left: 1px; /* 그룹멤버 오른쪽 세로선과 겹침 방지 */
}

.places-section::before {
  background-color: #EC4899;
}

.section-title {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #424242;
  font-weight: normal;
}
/* --- END: home/page.tsx 에서 가져온 스타일 --- */
`;

export default function LocationPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMap | null>(null);
  const tempMarker = useRef<NaverMarker | null>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const isMapClickedRecentlyRef = useRef(false);
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const previousOffsetYRef = useRef<number>(0);
  const startDragY = useRef<number | null>(null);
  const currentDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);
  const markers = useRef<{ [key: string]: NaverMarker }>({});
  const groupMemberMarkers = useRef<NaverMarker[]>([]); // 그룹 멤버 마커(네이버용)

  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces'); // activeView 상태 확장
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  const [locations, setLocations] = useState<LocationData[]>(MOCK_LOCATIONS.map(m => ({...m, category: m.category || '기타', memo: m.memo || '', favorite: m.favorite || false })));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newLocation, setNewLocation] = useState<NewLocationInput>({
    id: undefined,
    name: '',
    address: '',
    coordinates: [127.0276, 37.4979],
    notifications: false,
  });

  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const [locationSearchModalCaller, setLocationSearchModalCaller] = useState<"add" | "edit" | "panel" | null>(null);

  const [isSearchingLocationForPanel, setIsSearchingLocationForPanel] = useState(false);
  const [isSavingLocationPanel, setIsSavingLocationPanel] = useState(false);

  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [clickedCoordinates, setClickedCoordinates] = useState<NaverCoord | null>(null); 
  const [isEditingPanel, setIsEditingPanel] = useState(false);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]); 
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[] | null>(null);
  const [otherMembersSavedLocations, setOtherMembersSavedLocations] = useState<OtherMemberLocationRaw[]>([]); // 다른 멤버들 장소 상태
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const dataFetchedRef = useRef<boolean>(false);
  const [isFetchingGroupMembers, setIsFetchingGroupMembers] = useState(false);
  const [isLoadingOtherLocations, setIsLoadingOtherLocations] = useState(false); // 로딩 상태 추가

  const isDraggingRef = useRef(false);
  const initialScrollTopRef = useRef(0);

  useEffect(() => {
    setPortalContainer(document.body);
    const body = document.body;
    if (isAddModalOpen || isEditModalOpen || isLocationSearchModalOpen || isLocationInfoPanelOpen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = 'auto';
    }
    return () => {
      body.style.overflow = 'auto';
    };
  }, [isAddModalOpen, isEditModalOpen, isLocationSearchModalOpen, isLocationInfoPanelOpen]);
  
  const fetchGroupMembersData = async () => {
    if (dataFetchedRef.current) return;
    
    setIsFetchingGroupMembers(true);
    setIsLoading(true); 
    
    try {
      const GROUP_ID_EXAMPLE = '641'; 
      
      const memberData = await memberService.getGroupMembers(GROUP_ID_EXAMPLE);
      console.log('API에서 가져온 회원 데이터:', memberData);
      
      if (memberData && memberData.length > 0) {
        // 각 멤버의 저장된 장소도 함께 조회
        const formattedMembersPromises = memberData.map(async (member: any, index: number) => {
          let memberSavedLocations: LocationData[] = [];
          
          try {
            // 각 멤버의 저장된 장소 조회
            const memberLocationsRaw = await locationService.getOtherMembersLocations(member.mt_idx.toString());
            console.log(`멤버 ${member.mt_name}의 저장된 장소 (Raw):`, memberLocationsRaw);
            
            // LocationData 형식으로 변환 (locationService에서 이미 변환되었으므로 그대로 사용)
            memberSavedLocations = memberLocationsRaw.map((loc, locIndex) => {
              const converted = {
                id: loc.id || (loc.slt_idx ? loc.slt_idx.toString() : Date.now().toString()),
                name: loc.name || '제목 없음',
                address: loc.address || '주소 정보 없음',
                coordinates: loc.coordinates || [0, 0], // locationService에서 이미 올바르게 변환됨
                category: loc.category || '기타',
                memo: loc.memo || '',
                favorite: loc.favorite || false,
                notifications: loc.notifications ?? false // locationService에서 이미 slt_enter_alarm으로부터 변환됨, ?? 사용하여 undefined/null만 false로 변환
              };
              console.log(`멤버 ${member.mt_name}의 ${locIndex + 1}번째 장소 변환:`, { 원본: loc, 변환후: converted });
              return converted;
            });
          } catch (locationError) {
            console.warn(`멤버 ${member.mt_name}의 장소 조회 실패:`, locationError);
            // 오류 시 빈 배열 유지
          }
          
          return {
            id: member.mt_idx.toString(),
            name: member.mt_name || `멤버 ${index + 1}`,
            photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
            isSelected: false,
            location: { 
              lat: parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
              lng: parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
            },
            schedules: member.schedules || [], 
            savedLocations: memberSavedLocations, // 실제 조회된 장소 데이터 설정
            mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
            original_index: index
          };
        });
        
        // 모든 멤버의 데이터가 준비될 때까지 대기
        const formattedMembers = await Promise.all(formattedMembersPromises);
        console.log('모든 멤버의 장소 조회 완료:', formattedMembers);
        
        setGroupMembers(formattedMembers);
        dataFetchedRef.current = true;
      } else {
        console.warn('그룹 멤버 데이터가 없거나 API 호출 실패, MOCK 데이터 사용');
        setGroupMembers(MOCK_GROUP_MEMBERS); 
      }
    } catch (error) {
      console.error('그룹 멤버 데이터 조회 오류, MOCK 데이터 사용:', error);
      setGroupMembers(MOCK_GROUP_MEMBERS); 
    } finally {
      setIsLoading(false); 
      setIsFetchingGroupMembers(false);
    }
  };

  useEffect(() => {
    if (isMapInitialized) {
      fetchGroupMembersData();
    }
  }, [isMapInitialized]); 
    
  const loadNaverMapsAPI = () => {
    if (window.naver?.maps) {
      setNaverMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'naver-maps-script'; 
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_MAPS_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Naver Maps API loaded.');
      setTimeout(() => {
        if (window.naver?.maps?.Service) {
          console.log('Naver Maps Service is ready.');
          setNaverMapsLoaded(true);
        } else {
          console.error('Naver Maps Service failed to initialize.');
          setIsMapLoading(false);
        }
      }, 1000);
    };
    script.onerror = () => {
      console.error('Failed to load Naver Maps API.');
      setIsMapLoading(false); 
    };
    const existingScript = document.getElementById('naver-maps-script');
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
        const initialCenter = new window.naver.maps.LatLng(37.4979, 127.0276);
        const mapOptions = {
          ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
          center: initialCenter,
          zoom: MAP_CONFIG.NAVER.DEFAULT_OPTIONS?.zoom || 14,
          logoControl: false,
          mapDataControl: false,
        };
        map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);
        
        window.naver.maps.Event.addListener(map.current, 'init', () => {
          console.log('Naver Map initialized event triggered');
          setIsMapLoading(false);
          setIsMapInitialized(true);
          if(map.current) map.current.refresh(true);
        });

        window.naver.maps.Event.addListener(map.current, 'click', async (e: { coord: NaverCoord, pointerEvent: MouseEvent }) => { 
          console.log("[Map Click] Event started. Current isLocationInfoPanelOpen:", isLocationInfoPanelOpen, "isMapClickedRecentlyRef:", isMapClickedRecentlyRef.current);
          
          // 클릭 플래그 설정 - handleClickOutside와의 충돌 방지
          isMapClickedRecentlyRef.current = true;
          
          // 500ms 후 플래그 해제 (handleClickOutside가 실행되기 충분한 시간)
          setTimeout(() => {
            isMapClickedRecentlyRef.current = false;
            console.log("[Map Click] isMapClickedRecentlyRef reset to false after timeout.");
          }, 500);

          setClickedCoordinates(e.coord); 
          setIsEditingPanel(false); 
          setNewLocation({
            id: undefined,
            name: '', 
            address: '', 
            coordinates: [e.coord.x, e.coord.y],
            notifications: false,
          });

          if (tempMarker.current) tempMarker.current.setMap(null);
          tempMarker.current = new window.naver.maps.Marker({
            position: e.coord, 
            map: map.current
          });

          try {
            if (!window.naver?.maps?.Service) {
              console.warn('Naver Maps Service is not initialized yet');
              setNewLocation(prev => ({...prev, address: '주소 정보를 가져올 수 없습니다.'}));
              // 약간의 지연 후 패널 열기 (handleClickOutside와의 충돌 방지)
              setTimeout(() => {
                setIsLocationInfoPanelOpen(true);
                setBottomSheetState('collapsed');
              }, 100);
              return;
            }

            const service = window.naver.maps.Service;
            if (!service || typeof service.reverseGeocode !== 'function') {
              throw new Error('Reverse geocode service is not available');
            }

            service.reverseGeocode({
              coords: e.coord,
              orders: [service.OrderType.ADDR, service.OrderType.ROAD_ADDR].join(',')
            }, function(status: any, response: any) {
              if (status !== service.Status.OK) {
                setNewLocation(prev => ({...prev, address: ''}));
              } else {
                const result = response.v2;
                const roadAddr = result.address.jibunAddress || result.address.roadAddress;
                const fullAddress = roadAddr?.addressElements?.length > 0 ? roadAddr.addressElements.map((el:any)=>el.longName).join(' ') : (roadAddr || '주소 정보 없음');
                setNewLocation(prev => ({...prev, address: fullAddress}));
              }
              
              // 약간의 지연 후 패널 열기 (handleClickOutside와의 충돌 방지)
              setTimeout(() => {
                setIsLocationInfoPanelOpen(true);
                setBottomSheetState('collapsed');
                console.log("[Map Click] Location info panel opened after geocoding.");
              }, 100);
            });
          } catch(geoError) { 
            console.error('Reverse geocode error:', geoError);
            setNewLocation(prev => ({...prev, address: '주소 변환 중 오류가 발생했습니다.'}));
            
            // 약간의 지연 후 패널 열기 (handleClickOutside와의 충돌 방지)
            setTimeout(() => {
              setIsLocationInfoPanelOpen(true);
              setBottomSheetState('collapsed');
            }, 100);
          } 
        });

      } catch (error) {
        console.error('Naver Maps 초기화 중 오류가 발생했습니다:', error);
        setIsMapLoading(false);
      }
    }
    return () => {
      if (map.current && typeof map.current.destroy === 'function') {
        map.current.destroy();
      }
      map.current = null;
      setIsMapInitialized(false);
      if (tempMarker.current) { tempMarker.current.setMap(null); tempMarker.current = null; }
    };
  }, [naverMapsLoaded]);

  useEffect(() => {
    console.log("[AutoSelect Effect] Triggered. isMapInitialized:", isMapInitialized, "groupMembers.length:", groupMembers.length, "isFetchingGroupMembers:", isFetchingGroupMembers);
    
    // 지도가 초기화되고, 그룹멤버 데이터가 로드되었으며, 현재 로딩 중이 아닐 때 실행
    if (isMapInitialized && groupMembers.length > 0 && !isFetchingGroupMembers) {
      const isAnyMemberSelected = groupMembers.some(m => m.isSelected);
      console.log("[AutoSelect Effect] Conditions met. isAnyMemberSelected:", isAnyMemberSelected);
      
      if (!isAnyMemberSelected) { 
        console.log("[LocationPage] Map initialized and group members ready. Auto-selecting first member:", groupMembers[0].name);
        console.log("[LocationPage] First member savedLocations count:", groupMembers[0].savedLocations?.length || 0);
        
        // 첫번째 멤버 선택 (약간의 지연을 두어 UI 업데이트가 완료된 후 실행)
        setTimeout(() => {
          if (groupMembers[0] && groupMembers[0].id) {
            handleMemberSelect(groupMembers[0].id, false); 
          }
        }, 500);
      }
    } 
  }, [isMapInitialized, groupMembers, isFetchingGroupMembers, groupMembers.length]);
  
  const getBottomSheetClassName = () => {
    switch (bottomSheetState) {
      case 'collapsed': return 'bottom-sheet-collapsed';
      case 'expanded': return 'bottom-sheet-expanded';
      default: return 'bottom-sheet-collapsed';
    }
  };
  const handleDragStart = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startDragY.current = clientY;
    currentDragY.current = clientY;
    dragStartTime.current = Date.now();
    isDraggingRef.current = true;
    initialScrollTopRef.current = bottomSheetRef.current?.scrollTop || 0;

    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = 'none';
    }
  };
  const handleDragMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
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
      const collapsedY = window.innerHeight * 0.3;
      newTranslateY = Math.max(expandedY, Math.min(newTranslateY, collapsedY));
      bottomSheetRef.current.style.transform = `translateY(${newTranslateY}px)`;
      bottomSheetRef.current.style.transition = 'none';
    }
  };
  const handleDragEnd = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (startDragY.current === null || !bottomSheetRef.current || currentDragY.current === null) return;

    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaYOverall = clientY - startDragY.current;
    const deltaTime = dragStartTime.current ? Date.now() - dragStartTime.current : 0;
    
    const isDrag = Math.abs(deltaYOverall) > 10 || deltaTime > 200;

    if (isDrag) {
      bottomSheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      const velocity = deltaTime > 0 ? deltaYOverall / deltaTime : 0;
      const currentTransform = getComputedStyle(bottomSheetRef.current).transform;
      let currentSheetY = 0;
      if (currentTransform !== 'none') {
        const matrix = new DOMMatrixReadOnly(currentTransform);
        currentSheetY = matrix.m42;
      }
      const windowHeight = window.innerHeight;
      const threshold = windowHeight * 0.2;

      let finalState: 'expanded' | 'collapsed';
      
      if (Math.abs(velocity) > 0.5) {
        finalState = velocity < 0 ? 'expanded' : 'collapsed';
      } else {
        finalState = currentSheetY < threshold ? 'expanded' : 'collapsed';
      }
      setBottomSheetState(finalState);
    }

    // 스타일 복원
    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transform = '';
    }

    startDragY.current = null;
    currentDragY.current = null;
    dragStartTime.current = null;
    isDraggingRef.current = false;
  };
  const toggleBottomSheet = () => {
    const newState = bottomSheetState === 'collapsed' ? 'expanded' : 'collapsed';
    setBottomSheetState(newState);
    if (newState === 'collapsed') {
      setIsLocationInfoPanelOpen(false);
      if (tempMarker.current) {
        tempMarker.current.setMap(null);
      }
      // 마커 업데이트에 지연 추가 - 깜빡임 최소화
      setTimeout(() => {
        const currentSelectedMember = groupMembers.find(m => m.isSelected);
        if (currentSelectedMember) {
          if (activeView === 'selectedMemberPlaces') {
            // selectedMemberSavedLocations를 우선적으로 사용하고, 없으면 멤버의 savedLocations 사용
            const locationsToShow = selectedMemberSavedLocations || currentSelectedMember.savedLocations || [];
            addMarkersToMap(locationsToShow);
          } else {
            addMarkersToMapForOtherMembers(otherMembersSavedLocations);
          }
        } else {
          addMarkersToMap(locations); 
        }
      }, 200);
    }
  };

  const handleSearchLocationInternal = async (queryToSearch?: string) => {
    const currentSearchQuery = queryToSearch !== undefined ? queryToSearch : locationSearchQuery;
    if (!currentSearchQuery.trim()) {
      setLocationSearchResults([]);
      return;
    }
    if (locationSearchModalCaller === 'panel') {
      setIsSearchingLocationForPanel(true);
    } else {
      setIsSearchingLocation(true);
    }
    setLocationSearchResults([]);
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(currentSearchQuery)}`;
    console.log('[handleSearchLocationInternal] Using KAKAO_REST_API_KEY:', KAKAO_REST_API_KEY);
    try {
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setLocationSearchResults(data.documents?.map((doc: any, index: number) => ({ ...doc, temp_id: `${doc.x}-${doc.y}-${index}` })) || []);
    } catch (error) { 
      setLocationSearchResults([]); 
      console.error("주소 검색 오류:", error);
    }
    finally {
      if (locationSearchModalCaller === 'panel') {
        setIsSearchingLocationForPanel(false);
      } else {
        setIsSearchingLocation(false);
      }
    }
  };

  const handlePanelAddressSearch = () => {
    setLocationSearchModalCaller('panel');
    handleSearchLocationInternal(locationSearchQuery); 
  };

  const handleSelectLocationForPanel = (place: any) => {
    const newAddr = place.road_address_name || place.address_name || '';
    let newMapCoord: NaverCoord | null = null; 
    let newCoordsArray: [number, number] = newLocation.coordinates || [127.0276, 37.4979];

    if (place.y && place.x) { 
        newMapCoord = new window.naver.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
        newCoordsArray = [parseFloat(place.x), parseFloat(place.y)];
    }
    
    setNewLocation(prev => ({
      ...prev,
      name: place.place_name || prev.name || '', 
      address: newAddr,
      coordinates: newCoordsArray,
      notifications: false,
    }));

    if (newMapCoord && map.current && window.naver?.maps) { 
        setClickedCoordinates(newMapCoord); 
        
        if (tempMarker.current) {
            tempMarker.current.setMap(null);
        }
        tempMarker.current = new window.naver.maps.Marker({
            position: newMapCoord,
            map: map.current
        });

        map.current.panTo(newMapCoord);
        if (map.current.getZoom() < 15) {
          map.current.setZoom(15);
        }
    }
    
    setLocationSearchResults([]); 
    setIsEditingPanel(false);
  };
  
  const handleOpenLocationSearchModalForModals = (caller: "add" | "edit") => {
    console.log('[handleOpenLocationSearchModalForModals] Called by:', caller, 'Current newLocation.address:', newLocation.address);
    setLocationSearchModalCaller(caller);
    const currentAddress = newLocation.address || '';
    setLocationSearchQuery(currentAddress);
    if (currentAddress.trim()) handleSearchLocationInternal(currentAddress);
    else setLocationSearchResults([]);
    setIsLocationSearchModalOpen(true);
  };

  const handleSelectLocationForModals = (place: any) => {
    const newAddr = place.road_address_name || place.address_name || '';
    let newCoordsArray = newLocation.coordinates; 
    if (place.y && place.x) {
        newCoordsArray = [parseFloat(place.x), parseFloat(place.y)];
    }
    setNewLocation((prev: any) => ({
      ...prev,
      address: newAddr,
      coordinates: newCoordsArray,
      name: locationSearchModalCaller === 'add' && !prev.name ? (place.place_name || prev.name) : prev.name,
      notifications: false,
    }));
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
  };

  const handleConfirmPanelAction = async () => {
    if (!(newLocation.address?.trim() || newLocation.name?.trim())) {
      return;
    }
    setIsSavingLocationPanel(true);
    try {
      if (isEditingPanel) {
        console.log("Updating location:", newLocation);
        if (!newLocation.id) { 
          setIsSavingLocationPanel(false);
          return;
        }
        setLocations(prevLocations => prevLocations.map(loc => 
          loc.id === newLocation.id ? { 
            ...loc, 
            name: (newLocation.name?.trim() || newLocation.address || loc.name),
            address: newLocation.address || loc.address,
            coordinates: newLocation.coordinates || loc.coordinates,
            notifications: newLocation.notifications ?? loc.notifications, 
          } as LocationData : loc 
        ));
        if (clickedCoordinates && newLocation.id === clickedCoordinates.id && isEditingPanel) {
            setClickedCoordinates(new window.naver.maps.LatLng(newLocation.coordinates[1], newLocation.coordinates[0]));
        }
      } else {
        const newId = String(Date.now());
        const newLocEntry: LocationData = {
          id: newId,
          name: newLocation.name.trim() || newLocation.address, 
          address: newLocation.address, 
          coordinates: newLocation.coordinates, 
          category: '기타',
          memo: '',
          favorite: false,
          notifications: newLocation.notifications || false,
        };
        setLocations(prev => [newLocEntry, ...prev]);
        setClickedCoordinates(new window.naver.maps.LatLng(newLocation.coordinates[1], newLocation.coordinates[0]));
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
      }
      setIsLocationInfoPanelOpen(false);
      setIsEditingPanel(false);
      setNewLocation({ 
        name: '', 
        address: '', 
        coordinates: [127.0276, 37.4979], 
        notifications: false,
      });
    } catch (error) {
      console.error("장소 저장 오류:", error);
    } finally {
      setIsSavingLocationPanel(false);
    }
  };

  const renderModal = (modalContent: React.ReactNode, overlayClassName?: string) => {
    if (!portalContainer) return null;
    return ReactDOM.createPortal(
      <div className={`fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out ${overlayClassName || 'modal-overlay'}`}>
        {modalContent}
      </div>,
      portalContainer
    );
  };

  // 공통 마커 생성 함수
  const createMarker = (
    location: any, 
    index: number, 
    markerType: 'selected' | 'other'
  ) => {
    // 좌표 안전하게 파싱
    let lat = 0;
    let lng = 0;
    
    if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      lng = typeof location.coordinates[0] === 'number' ? location.coordinates[0] : parseFloat(String(location.coordinates[0])) || 0;
      lat = typeof location.coordinates[1] === 'number' ? location.coordinates[1] : parseFloat(String(location.coordinates[1])) || 0;
    } else if (location.slt_lat && location.slt_long) {
      lat = parseFloat(String(location.slt_lat || '0')) || 0;
      lng = parseFloat(String(location.slt_long || '0')) || 0;
    }
    
    // 좌표 유효성 검사
    if (lat === 0 && lng === 0) {
      console.error('[createMarker] 유효하지 않은 좌표입니다 (0, 0). 마커 생성을 건너뜁니다:', location);
      return null;
    }
    
    const position = new window.naver.maps.LatLng(lat, lng);
    const title = location.name || location.slt_title || '제목 없음';
    const locationId = location.id || (location.slt_idx ? location.slt_idx.toString() : `${markerType}_${index}`);
    const isSelectedByInfoPanel = isLocationInfoPanelOpen && newLocation.id === locationId && isEditingPanel;
    
    // 마커 타입에 따른 색상 설정
    const bgColor = isSelectedByInfoPanel ? '#FF0000' : '#4F46E5'; // 선택된 경우 빨간색, 아니면 인디고
    const dotColor = isSelectedByInfoPanel ? '#FF0000' : '#4F46E5'; // 선택된 경우 빨간색, 아니면 인디고
    
    console.log(`[createMarker] 마커 생성: ${title} at (${lat}, ${lng}), type: ${markerType}`);
    
    const markerContent = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="padding: 3px 7px; background-color: ${bgColor}; color: white; border-radius: 5px; font-size: 11px; font-weight: normal; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); margin-bottom: 3px;">
          ${title}
        </div>
        <div style="width: 12px; height: 12px; background-color: ${dotColor}; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
        </div>
      </div>
    `;

    const markerInstance = new window.naver.maps.Marker({
      position: position,
      map: map.current,
      title: title,
      icon: {
        content: markerContent,
        anchor: new window.naver.maps.Point(6, 38)
      }
    });

    markerInstance.setZIndex(isSelectedByInfoPanel ? 200 : 100);

    // 마커 클릭 이벤트
    window.naver.maps.Event.addListener(markerInstance, 'click', () => {
      console.log(`[createMarker] 마커 클릭됨: ${title}`);
      
      const clickedData = markerType === 'selected' 
        ? (locations.find(l => l.id === locationId) || selectedMemberSavedLocations?.find(l => l.id === locationId))
        : otherMembersSavedLocations?.find(l => l.id === locationId);
      
      setNewLocation({ 
        id: locationId,
        name: title,
        address: location.address || location.slt_add || '주소 정보 없음',
        coordinates: [lng, lat],
        category: clickedData?.category || location.category || '기타',
        memo: clickedData?.memo || location.memo || '',
        favorite: clickedData?.favorite || location.favorite || false,
        notifications: clickedData?.notifications || location.notifications || location.slt_enter_alarm === 'Y' || false,
      });
      setClickedCoordinates(position);
      setIsEditingPanel(true); 
      setIsLocationInfoPanelOpen(true);
      if (tempMarker.current) tempMarker.current.setMap(null); 
      
      if (bottomSheetState === 'collapsed') setBottomSheetState('expanded');
      
      // 지도 중심을 클릭된 마커로 이동
      map.current.setCenter(position);
      if (map.current.getZoom() < 16) {
        map.current.setZoom(16);
      }
      
      // 마커 선택 시 마커를 다시 그려서 빨간색으로 변경
      setTimeout(() => {
        const currentSelectedMember = groupMembers.find(m => m.isSelected);
        if (markerType === 'selected') {
          const locationsToShow = selectedMemberSavedLocations || currentSelectedMember?.savedLocations || locations;
          addMarkersToMap(locationsToShow);
        } else {
          addMarkersToMapForOtherMembers(otherMembersSavedLocations);
        }
      }, 100);
    });
    
    return { marker: markerInstance, id: `${locationId}_${index}` };
  };

  const addMarkersToMap = (locationsToDisplay: LocationData[]) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) {
      console.log('[addMarkersToMap] 지도 또는 네이버 API가 준비되지 않음');
      return;
    }
    
    console.log('[addMarkersToMap] 기존 마커 제거 시작');
    Object.values(markers.current).forEach(marker => {
      if (marker && typeof marker.setMap === 'function') marker.setMap(null);
    });
    markers.current = {};

    if (!locationsToDisplay || locationsToDisplay.length === 0) {
      console.log('[addMarkersToMap] 표시할 장소가 없음');
      return;
    }

    console.log(`[addMarkersToMap] ${locationsToDisplay.length}개의 장소에 대한 마커 생성 시작`);

    locationsToDisplay.forEach((location, index) => {
      if (!location.id) {
        console.warn('[addMarkersToMap] Location ID가 없습니다. 마커를 생성할 수 없습니다:', location);
        return;
      }
      
      const markerResult = createMarker(location, index, 'selected');
      if (markerResult) {
        markers.current[markerResult.id] = markerResult.marker;
        console.log(`[addMarkersToMap] 마커 생성 완료: ${location.name}, ID: ${markerResult.id}`);
      }
    });

    console.log(`[addMarkersToMap] 총 ${Object.keys(markers.current).length}개의 마커가 생성됨`);
  };
  
  const handleAddLocation = () => {
    const locationToAdd: LocationData = {
      id: String(Date.now()),
      name: newLocation.name,
      address: newLocation.address,
      coordinates: newLocation.coordinates,
      category: '기타',
            memo: '',
            favorite: false,
            notifications: false,
    };
    setLocations(prev => [locationToAdd, ...prev]);
          setIsAddModalOpen(false);
          setNewLocation({
            name: '',
            address: '',
            coordinates: [127.0276, 37.4979],
            notifications: false,
          });
  };

  const handleSaveEditLocation = () => {
    if (!newLocation.id) { 
        return;
    }
    const currentIdStr = newLocation.id;

    const otherMemberLocToUpdate = getOtherMemberLocationById(currentIdStr, otherMembersSavedLocations);

    if (otherMemberLocToUpdate) {
      const updatedOtherMemberLoc: OtherMemberLocationRaw = {
        ...otherMemberLocToUpdate,
        slt_title: newLocation.name || otherMemberLocToUpdate.slt_title,
        slt_add: newLocation.address || otherMemberLocToUpdate.slt_add,
        slt_lat: newLocation.coordinates ? String(newLocation.coordinates[1]) : otherMemberLocToUpdate.slt_lat,
        slt_long: newLocation.coordinates ? String(newLocation.coordinates[0]) : otherMemberLocToUpdate.slt_long,
        slt_enter_alarm: newLocation.notifications ? 'Y' : 'N',
      };
      const newOtherMembersSavedLocations = otherMembersSavedLocations.map(loc => 
        loc.slt_idx === otherMemberLocToUpdate.slt_idx ? updatedOtherMemberLoc : loc
      );
      setOtherMembersSavedLocations(newOtherMembersSavedLocations);
      if (activeView === 'otherMembersPlaces') {
        addMarkersToMapForOtherMembers(newOtherMembersSavedLocations);
      }
    } else {
      const locationDataToUpdate = locations.find(loc => loc.id === currentIdStr) || 
                               selectedMemberSavedLocations?.find(loc => loc.id === currentIdStr);
      
      if (locationDataToUpdate) {
        const updatedLocationData: LocationData = {
          ...locationDataToUpdate, 
          name: newLocation.name || locationDataToUpdate.name, 
          address: newLocation.address || locationDataToUpdate.address, 
          coordinates: newLocation.coordinates || locationDataToUpdate.coordinates,
          category: newLocation.category || locationDataToUpdate.category,
          memo: newLocation.memo || locationDataToUpdate.memo,
          favorite: newLocation.favorite ?? locationDataToUpdate.favorite,
          notifications: newLocation.notifications ?? locationDataToUpdate.notifications, 
        };

        setLocations(prev => prev.map(loc => loc.id === currentIdStr ? updatedLocationData : loc));
        if (selectedMemberSavedLocations) {
          setSelectedMemberSavedLocations(prev => prev ? prev.map(loc => loc.id === currentIdStr ? updatedLocationData : loc) : null);
        }
        setGroupMembers(prevMembers => prevMembers.map(member => ({
          ...member,
          savedLocations: member.savedLocations.map(sl => sl.id === currentIdStr ? updatedLocationData : sl)
        })));
        
        if (activeView === 'selectedMemberPlaces') {
            const currentSelectedMember = groupMembers.find(m => m.isSelected);
            const listToUpdate = selectedMemberSavedLocations || currentSelectedMember?.savedLocations || locations;
            addMarkersToMap(listToUpdate.map(loc => loc.id === currentIdStr ? updatedLocationData : loc) );
        }
      }
    }
    
    if (isLocationInfoPanelOpen && isEditingPanel && newLocation.id === currentIdStr) {
       setNewLocation({ 
            id: currentIdStr, 
            name: newLocation.name,
            address: newLocation.address,
            coordinates: newLocation.coordinates,
            category: newLocation.category,
            memo: newLocation.memo,
            favorite: newLocation.favorite,
            notifications: newLocation.notifications,
        });
        if (newLocation.coordinates) {
            setClickedCoordinates(new window.naver.maps.LatLng(newLocation.coordinates[1], newLocation.coordinates[0]));
        }
    }
    
    setIsEditModalOpen(false); 
  };

  const handleCloseLocationSearchModal = () => {
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setLocationSearchModalCaller(null);
  };

  const updateMemberMarkers = (members: GroupMember[]) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) return;

    groupMemberMarkers.current.forEach(marker => marker.setMap(null));
    
    const newMemberMarkers: NaverMarker[] = [];
    const selectedMembersToMark = members.filter(member => member.isSelected);

    selectedMembersToMark.forEach(member => {
      try {
        const photoForMarker = member.photo ?? getDefaultImage(member.mt_gender, member.original_index); 
        const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
        const markerInstance = new window.naver.maps.Marker({
          position: position,
          map: map.current,
          icon: {
            content: `
              <div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid #4F46E5; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                  <img 
                    src="${photoForMarker}" 
                    alt="${member.name}" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    onerror="this.src='${getDefaultImage(member.mt_gender, member.original_index)}';"
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
          zIndex: 150 
        });
        newMemberMarkers.push(markerInstance);
      } catch (error) {
        console.error(`멤버 마커 생성 오류 (${member.name}):`, error);
      }
    });

    groupMemberMarkers.current = newMemberMarkers;

    if (selectedMembersToMark.length === 1) {
      const member = selectedMembersToMark[0];
      if (map.current && member.location) {
        const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
        map.current.panTo(position); 
        if (map.current.getZoom() < 16) {
           map.current.setZoom(16);
        }
      }
    } else if (selectedMembersToMark.length > 1) {
      if (map.current) {
        const bounds = new window.naver.maps.LatLngBounds();
        selectedMembersToMark.forEach(member => {
          if (member.location) {
            bounds.extend(new window.naver.maps.LatLng(member.location.lat, member.location.lng));
          }
        });
        if (!bounds.isEmpty()) {
            map.current.fitBounds(bounds);
        }
      }
    }
  };

  const handleMemberSelect = async (memberId: string, openLocationPanel = false) => { 
    const updatedMembers = groupMembers.map(member => {
      if (member.id === memberId) {
        return { ...member, isSelected: !member.isSelected };
      } else {
        return { ...member, isSelected: false }; 
      }
    });
    setGroupMembers(updatedMembers);
    updateMemberMarkers(updatedMembers); 
  
    const newlySelectedMember = updatedMembers.find(member => member.isSelected);
  
    if (newlySelectedMember && map.current && window.naver?.maps) {
      // 선택된 멤버의 위치로 지도 중심 이동
      console.log('[handleMemberSelect] 멤버 선택:', newlySelectedMember.name, '위치:', newlySelectedMember.location);
      const memberPosition = new window.naver.maps.LatLng(newlySelectedMember.location.lat, newlySelectedMember.location.lng);
      map.current.setCenter(memberPosition);
      map.current.setZoom(16); // 적절한 줌 레벨로 설정
      
      // 멤버의 저장된 장소 처리
      if (newlySelectedMember.savedLocations && newlySelectedMember.savedLocations.length > 0) {
        // 이미 로드된 장소가 있으면 바로 사용
        console.log('[handleMemberSelect] 이미 로드된 장소 사용:', newlySelectedMember.savedLocations.length, '개');
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
          notifications: loc.notifications,
          slt_enter_alarm: loc.notifications ? 'Y' : 'N'
        }));
        setOtherMembersSavedLocations(rawLocationsForOtherMembers);
        
        // activeView 설정
        setActiveView('selectedMemberPlaces');
        
        // 즉시 마커 생성
        setTimeout(() => {
          addMarkersToMap(newlySelectedMember.savedLocations);
          console.log('[handleMemberSelect] 기존 장소로 마커 생성:', newlySelectedMember.savedLocations.length, '개');
        }, 300);
        
      } else {
        // 저장된 장소가 없으면 API에서 조회
        console.log('[handleMemberSelect] API에서 장소 조회 시작');
        setIsLoadingOtherLocations(true);
        
        try {
          const memberLocationsRaw = await locationService.getOtherMembersLocations(newlySelectedMember.id);
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
            notifications: loc.notifications || loc.slt_enter_alarm === 'Y'
          }));
          
          // 상태 업데이트
          setSelectedMemberSavedLocations(convertedLocations);
          setOtherMembersSavedLocations(memberLocationsRaw);
          setActiveView('selectedMemberPlaces');
          
          // 그룹멤버 상태의 savedLocations도 업데이트 (다음에는 API 호출 없이 사용하기 위해)
          setGroupMembers(prevMembers => 
            prevMembers.map(member => 
              member.id === memberId 
                ? { ...member, savedLocations: convertedLocations }
                : member
            )
          );
          
          // 마커 생성
          setTimeout(() => {
            addMarkersToMap(convertedLocations);
            console.log('[handleMemberSelect] API 조회 장소로 마커 생성:', convertedLocations.length, '개');
          }, 300);
          
        } catch (error) {
          console.error("Failed to fetch selected member's locations in handleMemberSelect:", error);
          setSelectedMemberSavedLocations([]);
          setOtherMembersSavedLocations([]);
          setActiveView('selectedMemberPlaces');
          
          // 오류 시 빈 마커
          setTimeout(() => {
            addMarkersToMap([]);
          }, 300);
        } finally {
          setIsLoadingOtherLocations(false);
        }
      }

      if (!openLocationPanel) {
        setIsLocationInfoPanelOpen(false);
        setIsEditingPanel(false);
        if (tempMarker.current) {
            tempMarker.current.setMap(null);
        }
      }
    } else {
      // 아무도 선택되지 않은 경우
      setSelectedMemberSavedLocations(null); 
      setOtherMembersSavedLocations([]); 
      setActiveView('selectedMemberPlaces'); 
      addMarkersToMap(locations); 
      setIsLocationInfoPanelOpen(false); 
      setIsEditingPanel(false);
    }
  };

  useEffect(() => {
    const fetchOtherLocationsAndUpdateMarkers = async () => {
      const currentSelectedMember = groupMembers.find(m => m.isSelected);
      if (activeView === 'otherMembersPlaces' && currentSelectedMember?.id) {
        setIsLoadingOtherLocations(true);
        try {
          const fetchedLocationsRaw = await locationService.getOtherMembersLocations(currentSelectedMember.id);
          console.log("[useEffect/activeView] Other members' locations (raw):", fetchedLocationsRaw);
          setOtherMembersSavedLocations(fetchedLocationsRaw);
          // 약간의 지연 후 마커 업데이트 - 깜빡임 최소화
          setTimeout(() => {
            addMarkersToMapForOtherMembers(fetchedLocationsRaw);
          }, 100);
        } catch (error) {
          console.error("Failed to fetch other members' locations on view change", error);
          setOtherMembersSavedLocations([]);
          setTimeout(() => {
            addMarkersToMapForOtherMembers([]);
          }, 100);
        } finally {
          setIsLoadingOtherLocations(false);
        }
      } else if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
          // 약간의 지연 후 마커 업데이트 - 깜빡임 최소화
          setTimeout(() => {
            addMarkersToMap(selectedMemberSavedLocations || currentSelectedMember.savedLocations || []);
          }, 100);
      } else if (!currentSelectedMember) {
          setTimeout(() => {
            addMarkersToMap(locations);
          }, 100);
      }
    };

    if (isMapInitialized) { 
        fetchOtherLocationsAndUpdateMarkers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapInitialized, activeView, groupMembers.find(m => m.isSelected)?.id]);

  useEffect(() => {
    console.log('[useEffect for handleClickOutside] Registering or unregistering. isLocationInfoPanelOpen:', isLocationInfoPanelOpen);
    const handleClickOutside = (event: MouseEvent) => {
      console.log('[handleClickOutside] Triggered. isMapClickedRecentlyRef:', isMapClickedRecentlyRef.current, 'isLocationInfoPanelOpen:', isLocationInfoPanelOpen);
      
      // 지도 클릭이 최근에 발생했다면 무시
      if (isMapClickedRecentlyRef.current) {
        console.log('[handleClickOutside] Map was clicked recently. Ignoring click outside event.');
        return;
      }
      
      // 패널이 열려있지 않다면 무시
      if (!isLocationInfoPanelOpen) {
        return;
      }
      
      console.log('[handleClickOutside] Checking if click is outside panel. Panel Ref:', infoPanelRef.current, 'Target:', event.target);
      
      // 패널 외부 클릭인지 확인
      if (infoPanelRef.current && !infoPanelRef.current.contains(event.target as Node)) {
        console.log('[handleClickOutside] Click is outside panel. Closing panel.');
        setIsLocationInfoPanelOpen(false);
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
        // 마커 업데이트에 지연 추가 - 깜빡임 최소화
        setTimeout(() => {
          const currentSelectedMember = groupMembers.find(m => m.isSelected);
          if (currentSelectedMember) {
              if (activeView === 'selectedMemberPlaces') {
                  addMarkersToMap(selectedMemberSavedLocations || currentSelectedMember.savedLocations || []);
              } else {
                  addMarkersToMapForOtherMembers(otherMembersSavedLocations);
              }
          } else {
              addMarkersToMap(locations);
          }
        }, 200);
        setIsEditingPanel(false);
      }
    };

    if (isLocationInfoPanelOpen) {
      console.log('[useEffect for handleClickOutside] Adding mousedown listener.');
      // 약간의 지연 후 이벤트 리스너 추가 (지도 클릭 이벤트가 완전히 처리된 후)
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 150);
      
      return () => {
        clearTimeout(timeoutId);
        console.log('[useEffect for handleClickOutside] Cleanup: Removing mousedown listener.');
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      console.log('[useEffect for handleClickOutside] Panel is closed, not adding listener.');
      document.removeEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isLocationInfoPanelOpen, activeView, selectedMemberSavedLocations, otherMembersSavedLocations, locations]);

  useEffect(() => {
    if (map.current && isMapInitialized) {
      let targetOffsetY = 0;

      if (bottomSheetState === 'expanded') {
        const visibleHeightExpanded = window.innerHeight * 0.60;
        targetOffsetY = -(visibleHeightExpanded * 0.30); 
      } else if (bottomSheetState === 'collapsed') {
        const visibleHeightCollapsed = 140; 
        targetOffsetY = -(visibleHeightCollapsed * 0.15); 
      }

      const panAmount = targetOffsetY - previousOffsetYRef.current;
      if (panAmount !== 0) {
        map.current.panBy(0, panAmount);
      }
      previousOffsetYRef.current = targetOffsetY;
    }
  }, [bottomSheetState, isMapInitialized]); 

  // 뷰 변경 핸들러 함수 개선 - 마커 깜빡임 최소화
  const handleViewChange = (newView: 'selectedMemberPlaces' | 'otherMembersPlaces') => {
    if (activeView === newView) return; // 같은 뷰면 아무것도 하지 않음
    
    setActiveView(newView);
    
    // 약간의 지연을 두어 뷰 전환 후 마커 업데이트
    setTimeout(() => {
      const currentSelectedMember = groupMembers.find(m => m.isSelected);
      
      if (newView === 'selectedMemberPlaces') {
        if (currentSelectedMember) {
          const locationsToShow = selectedMemberSavedLocations || currentSelectedMember.savedLocations || [];
          addMarkersToMap(locationsToShow);
        } else {
          addMarkersToMap(locations);
        }
      } else if (newView === 'otherMembersPlaces') {
        if (otherMembersSavedLocations.length > 0) {
          addMarkersToMapForOtherMembers(otherMembersSavedLocations);
        } else {
          addMarkersToMapForOtherMembers([]);
        }
      }
    }, 100);
  };

  const handleSwipeScroll = () => {
    if (swipeContainerRef.current) {
      const { scrollLeft, clientWidth, scrollWidth } = swipeContainerRef.current;
      // 현재 스크롤 위치가 전체 스크롤 가능 너비의 중간을 넘었는지 여부로 판단
      // (자식 요소가 2개라고 가정)
      if (scrollWidth > clientWidth) { // 스크롤 가능한 경우에만
        if (scrollLeft >= (scrollWidth - clientWidth) / 2 && activeView !== 'otherMembersPlaces') {
          handleViewChange('otherMembersPlaces');
        } else if (scrollLeft < (scrollWidth - clientWidth) / 2 && activeView !== 'selectedMemberPlaces') {
          handleViewChange('selectedMemberPlaces');
        }
      }
    }
  };

  useEffect(() => {
    if (swipeContainerRef.current) {
        const firstChild = swipeContainerRef.current.children[0] as HTMLElement;
        const secondChild = swipeContainerRef.current.children[1] as HTMLElement;

        if (activeView === 'selectedMemberPlaces' && firstChild) {
            swipeContainerRef.current.scrollTo({ left: firstChild.offsetLeft, behavior: 'smooth' });
        } else if (activeView === 'otherMembersPlaces' && secondChild) {
            swipeContainerRef.current.scrollTo({ left: secondChild.offsetLeft, behavior: 'smooth' });
        }
    }
  }, [activeView]); // selectedMemberSavedLocations, otherMembersSavedLocations 제거

  const handleDeleteLocation = (idToDelete?: number | string) => { 
    if (idToDelete === undefined) return;

    const idStr = String(idToDelete);
    const idNum = typeof idToDelete === 'number' ? idToDelete : parseInt(idStr, 10);

    setLocations(prevLocations => prevLocations.filter(loc => loc.id !== idStr));

    if (selectedMemberSavedLocations) {
      setSelectedMemberSavedLocations(prevSavedLocs => 
        prevSavedLocs ? prevSavedLocs.filter(loc => loc.id !== idStr) : null
      );
    }
    if (!isNaN(idNum)) {
        setOtherMembersSavedLocations(prevOtherSavedLocs => 
            prevOtherSavedLocs.filter(loc => loc.slt_idx !== idNum)
        );
    }
    
    setGroupMembers(prevMembers => prevMembers.map(member => {
      if (member.savedLocations.some(loc => loc.id === idStr)) {
        return { ...member, savedLocations: member.savedLocations.filter(loc => loc.id !== idStr) };
      }
      return member;
    }));

    // 해당 ID를 가진 모든 마커 제거 (새로운 마커 ID 체계 대응)
    Object.keys(markers.current).forEach(markerId => {
      if (markerId.startsWith(idStr + '_')) {
        markers.current[markerId].setMap(null);
        delete markers.current[markerId];
      }
    });

    if (newLocation.id === idStr) {
      setIsLocationInfoPanelOpen(false);
      setIsEditingPanel(false);
      setNewLocation({ name: '', address: '', coordinates: [127.0276, 37.4979], notifications: false });
      if(tempMarker.current) tempMarker.current.setMap(null);
    }
    
    // 마커 재생성은 500ms 지연 후 실행 - 깜빡임 최소화
    setTimeout(() => {
      const currentSelectedMember = groupMembers.find(m => m.isSelected);
      if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
          const updatedSavedLocations = (selectedMemberSavedLocations || currentSelectedMember.savedLocations || []).filter(loc => loc.id !== idStr);
          addMarkersToMap(updatedSavedLocations);
      } else if (activeView === 'otherMembersPlaces' && !isNaN(idNum)){
          addMarkersToMapForOtherMembers(otherMembersSavedLocations.filter(loc => loc.slt_idx !== idNum));
      } else { 
          addMarkersToMap(locations.filter(loc => loc.id !== idStr));
      }
    }, 500);
  };
  
  // 다른 멤버의 위치 데이터를 위한 함수 개선
  const addMarkersToMapForOtherMembers = (locationsToDisplay: any[]) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) {
      console.log('[addMarkersToMapForOtherMembers] 지도 또는 네이버 API가 준비되지 않음');
      return;
    }
    
    console.log('[addMarkersToMapForOtherMembers] 기존 마커 제거 시작');
    Object.values(markers.current).forEach(marker => {
      if (marker && typeof marker.setMap === 'function') marker.setMap(null);
    });
    markers.current = {};

    if (!locationsToDisplay || locationsToDisplay.length === 0) {
      console.log('[addMarkersToMapForOtherMembers] 표시할 장소가 없음');
      return;
    }

    console.log(`[addMarkersToMapForOtherMembers] ${locationsToDisplay.length}개의 장소에 대한 마커 생성 시작`);

    locationsToDisplay.forEach((location, index) => {
      const markerResult = createMarker(location, index, 'other');
      if (markerResult) {
        markers.current[markerResult.id] = markerResult.marker;
        console.log(`[addMarkersToMapForOtherMembers] 마커 생성 완료: ${location.name || location.slt_title}, ID: ${markerResult.id}`);
      }
    });

    console.log(`[addMarkersToMapForOtherMembers] 총 ${Object.keys(markers.current).length}개의 마커가 생성됨`);
  };

  // 다른 멤버 위치 데이터 ID로 조회하는 함수 추가
  const getOtherMemberLocationById = (id: string, otherLocations: any[]): any => {
    if (!otherLocations || !id) return null;
    return otherLocations.find(loc => loc.id === id || loc.slt_idx === id || (loc.slt_idx && String(loc.slt_idx) === id));
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <PageContainer 
        title="내 장소" 
        showHeader={false} 
        showBackButton={false}
        className="p-0 m-0 w-full h-screen overflow-hidden relative"
      >
        {isMapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        )}
        <div className="full-map-container">
          <div 
            ref={mapContainer} 
            className="w-full h-full"
          />
        </div>

        {isLocationInfoPanelOpen && (
          <div 
            ref={infoPanelRef} 
            className={`location-info-panel open`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {isEditingPanel ? "장소 정보" : 
                  (groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 새 장소 등록` : "새 장소 등록")
                } 
              </h3>
              <div className="flex items-center space-x-1"> 
                {isEditingPanel && (
                  <button
                    onClick={() => {
                      const newNotificationStatus = !newLocation.notifications;
                      setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
                      if (newLocation.id) {
                        const locationIdStr = newLocation.id;
                        
                        const otherMemberLoc = getOtherMemberLocationById(locationIdStr, otherMembersSavedLocations);
                        if (otherMemberLoc) {
                            setOtherMembersSavedLocations(prevOther => prevOther.map(loc => 
                                loc.slt_idx === otherMemberLoc.slt_idx ? { ...loc, slt_enter_alarm: newNotificationStatus ? 'Y' : 'N' } : loc
                            ));
                        } else {
                            const updateNotifInLocationDataList = (list: LocationData[] | null) => 
                                list ? list.map(loc => loc.id === locationIdStr ? { ...loc, notifications: newNotificationStatus } : loc) : null;
                            
                            setLocations(prevLocs => prevLocs.map(loc =>
                              loc.id === locationIdStr ? { ...loc, notifications: newNotificationStatus } : loc
                            ));
                            setSelectedMemberSavedLocations(updateNotifInLocationDataList);
                            setGroupMembers(prevMembers => prevMembers.map(member => ({
                                ...member,
                                savedLocations: member.savedLocations.map(sl => 
                                    sl.id === locationIdStr ? {...sl, notifications: newNotificationStatus} : sl
                                )
                            })));
                        }
                      }
                    }}
                    className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                      newLocation.notifications ? 'text-yellow-500 hover:text-yellow-600' : 'text-red-500 hover:text-red-600'
                    }`}
                    aria-label={newLocation.notifications ? '알림 끄기' : '알림 켜기'}
                  >
                    {newLocation.notifications ? <FiBell size={18} /> : <FiBellOff size={18} />}
                  </button>
                )}
                <button onClick={() => {
                  setIsLocationInfoPanelOpen(false);
                  if (tempMarker.current) tempMarker.current.setMap(null);
                  setIsEditingPanel(false);
                  const currentSelectedMember = groupMembers.find(m => m.isSelected);
                  if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
                      addMarkersToMap(currentSelectedMember.savedLocations || []);
                  } else if (activeView === 'otherMembersPlaces'){
                      addMarkersToMapForOtherMembers(otherMembersSavedLocations);
                  } else if (!currentSelectedMember) {
                      addMarkersToMap(locations);
                  }
                }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"> 
                  <FiX size={20}/>
                </button>
              </div>
            </div>

            {isEditingPanel ? (
              <>
                <div className="mb-4"> 
                  <p className="text-base font-semibold text-gray-800 truncate">{newLocation.name}</p>
                  <p className="text-sm text-gray-600 mt-1 break-words">{newLocation.address || '주소 정보 없음'}</p>
                </div>
                <div className="flex space-x-2 mt-6"> 
                  <Button 
                      variant="danger" 
                      onClick={() => handleDeleteLocation(newLocation.id ? 
                        (getOtherMemberLocationById(newLocation.id, otherMembersSavedLocations) ? parseInt(newLocation.id) : newLocation.id) 
                        : undefined
                      )} 
                      className="flex-1"
                  >
                      삭제
                  </Button>
                  <Button 
                      variant="secondary" 
                      onClick={() => {
                          setIsLocationInfoPanelOpen(false);
                          if (tempMarker.current) tempMarker.current.setMap(null);
                          setIsEditingPanel(false);
                          const currentSelectedMember = groupMembers.find(m => m.isSelected);
                          if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
                              addMarkersToMap(currentSelectedMember.savedLocations || []);
                          } else if (activeView === 'otherMembersPlaces'){
                              addMarkersToMapForOtherMembers(otherMembersSavedLocations);
                          } else if (!currentSelectedMember){
                               addMarkersToMap(locations);
                          }
                      }} 
                      className="flex-1"
                  >
                      닫기
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="지번, 도로명, 건물명으로 검색"
                    className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePanelAddressSearch();
                      }
                    }}
                  />
                  {isSearchingLocationForPanel ? (
                    <FiLoader className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 animate-spin" />
                  ) : (
                    <FaSearchSolid className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer" onClick={handlePanelAddressSearch} />
                  )}
                </div>
                {locationSearchModalCaller === 'panel' && locationSearchResults.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-indigo-600 mt-3 mb-1 px-1">검색 결과</p>
                    <div className="address-search-results-in-panel bg-gray-100"> 
                      <ul className="divide-y divide-gray-200"> 
                        {locationSearchResults.map((place) => (
                          <li key={place.temp_id || place.id} className="p-2 cursor-pointer hover:bg-gray-200" onClick={() => handleSelectLocationForPanel(place)}> 
                            <p className="font-semibold text-gray-800 truncate text-[11px]">{place.place_name}</p> 
                            <p className="text-gray-600 truncate text-[11px]">{place.road_address_name || place.address_name}</p> 
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
                <div className="mt-4 mb-3"> 
                  <p className="text-xs font-medium text-indigo-600 mb-1">선택한 위치 주소</p>
                  <div className="flex text-sm font-medium text-gray-700 min-h-[20px]">
                    <span className="opacity-0 pointer-events-none select-none text-xs font-medium text-indigo-600 mb-1">
                      장소 태그 (이름)
                    </span>
                    <span className="ml-[-7ch]"> 
                      {isLocationInfoPanelOpen ? 
                        (newLocation.address ? newLocation.address : (clickedCoordinates && !newLocation.address ? ' 주소 변환 중...' : ' 지도를 클릭하거나 검색하세요.')) 
                        : ''}
                    </span>
                  </div>
                </div>
                <div className="mb-6 mt-4"> 
                  <label htmlFor="panelLocationName" className="block text-xs font-medium text-indigo-600 mb-1">장소 태그 (이름)</label>
                  <input
                    type="text"
                    id="panelLocationName"
                    className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="이 장소에 대한 나만의 이름을 지어주세요."
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="flex space-x-2 mt-4"> 
                  <Button variant="secondary" onClick={() => {
                    setIsLocationInfoPanelOpen(false);
                    if (tempMarker.current) tempMarker.current.setMap(null);
                    setIsEditingPanel(false);
                    const currentSelectedMember = groupMembers.find(m => m.isSelected);
                    if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
                        addMarkersToMap(currentSelectedMember.savedLocations || []);
                    } else if (activeView === 'otherMembersPlaces'){
                        addMarkersToMapForOtherMembers(otherMembersSavedLocations);
                    } else if (!currentSelectedMember){
                         addMarkersToMap(locations);
                    }
                  }} className="flex-1">닫기</Button>
                  <Button variant="primary" onClick={handleConfirmPanelAction} className="flex-1" disabled={isSavingLocationPanel}>
                    {isSavingLocationPanel ? '저장 중...' : "내 장소 등록"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div
          ref={bottomSheetRef}
          className={`bottom-sheet ${getBottomSheetClassName()} hide-scrollbar`}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div className="bottom-sheet-handle"></div>
          <div className="px-4 pb-4">
            <div
              ref={swipeContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
              onScroll={handleSwipeScroll}
            >
              <div className="w-full flex-shrink-0 snap-start">
                 <div className="content-section members-section min-h-[180px] max-h-[180px] overflow-y-auto">
                   <h2 className="text-lg font-medium text-gray-900 flex justify-between items-center section-title">
                     그룹 멤버
                     {isFetchingGroupMembers && <FiLoader className="animate-spin ml-2 text-indigo-500" size={18}/>}
                     <Link 
                       href="/group" 
                       className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                     >
                       <FiPlus className="h-3 w-3 mr-1" />
                       그룹 관리
                     </Link>
                   </h2>
                   {isLoading ? (
                    <div className="text-center py-3 text-gray-500">
                      <FiLoader className="animate-spin mx-auto mb-1" />
                      <p>멤버 정보를 불러오는 중...</p>
                    </div>
                   ) : groupMembers.length > 0 ? (
                     <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-2">
                       {groupMembers.map((member) => (
                         <div key={member.id} className="flex flex-col items-center p-0 flex-shrink-0">
                           <button
                             onClick={() => handleMemberSelect(member.id)}
                             className={`flex flex-col items-center focus:outline-none`}
                           >
                             <div className={`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${member.isSelected ? 'border-indigo-500 ring-2 ring-indigo-300 scale-110' : 'border-transparent'}`}>
                               <img 
                                src={member.photo ?? getDefaultImage(member.mt_gender, member.original_index)} 
                                alt={member.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = getDefaultImage(member.mt_gender, member.original_index);
                                  target.onerror = null; 
                                }}
                               />
                             </div>
                             <span className={`block text-xs font-medium mt-1.5 ${member.isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
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
              </div>

              {/* 다른 멤버들의 장소 뷰 (스와이프 대상) */}
              <div className="w-full flex-shrink-0 snap-start">
                <div className="content-section places-section min-h-[180px] max-h-[180px] overflow-y-auto">
                  <h2 className="text-lg font-medium text-gray-900 flex justify-between items-center section-title">
                    {groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}의 장소` : '다른 멤버들의 장소'}
                    {isLoadingOtherLocations && <FiLoader className="animate-spin ml-2 text-indigo-500" size={18}/>}
                  </h2>
                  {isLoadingOtherLocations ? (
                    <div className="text-center py-3 text-gray-500">
                      <FiLoader className="animate-spin mx-auto mb-1" />
                      <p>다른 멤버 장소 로딩 중...</p>
                    </div>
                  ) : otherMembersSavedLocations.length > 0 ? (
                    <div className="flex overflow-x-auto space-x-3 pb-2 hide-scrollbar -mx-1 px-1">
                      {otherMembersSavedLocations.map(location => {
                        // 좌표 파싱 전에 location 객체 전체를 로깅
                        console.log(`[LOCATION] 전체 location 객체:`, location);
                        
                        // 다양한 좌표 필드 시도
                        let lat = 0;
                        let lng = 0;
                        
                        // 우선순위: coordinates > slt_lat/slt_long > 기타 필드들
                        if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
                          lat = typeof location.coordinates[1] === 'number' ? location.coordinates[1] : parseFloat(String(location.coordinates[1])) || 0;
                          lng = typeof location.coordinates[0] === 'number' ? location.coordinates[0] : parseFloat(String(location.coordinates[0])) || 0;
                          console.log(`[LOCATION] coordinates 배열에서 좌표 추출: lat=${lat}, lng=${lng}`);
                        } else if (location.slt_lat && location.slt_long) {
                          lat = parseFloat(String(location.slt_lat || '0')) || 0;
                          lng = parseFloat(String(location.slt_long || '0')) || 0;
                          console.log(`[LOCATION] slt_lat/slt_long에서 좌표 추출: lat=${lat}, lng=${lng}`);
                        } else {
                          console.error(`[LOCATION] 유효한 좌표를 찾을 수 없습니다:`, location);
                        }
                        
                        console.log(`[LOCATION] 최종 파싱된 좌표: lat=${lat}, lng=${lng}`);
                        
                        // 좌표 유효성 검사
                        if (lat === 0 && lng === 0) {
                          console.error('[LOCATION] 유효하지 않은 좌표입니다 (0, 0). 지도 중심 이동을 건너뜁니다.');
                          return null;
                        }
                        
                        return (
                          <div 
                            key={location.slt_idx} 
                            className="flex-shrink-0 w-48 bg-white rounded-lg shadow p-3.5 cursor-pointer hover:shadow-lg transition-shadow duration-200 ease-in-out transform hover:-translate-y-0.5"
                            onClick={() => {
                              console.log(`[LOCATION] 장소 클릭됨: ${location.name || location.slt_title}, 좌표: [${lat}, ${lng}]`);
                              console.log(`[LOCATION] 지도 초기화 상태: ${isMapInitialized}, 지도 객체 존재: ${!!map.current}, 네이버 API: ${!!window.naver?.maps}`);
                              
                              // 좌표 유효성 검사
                              if (lat === 0 && lng === 0) {
                                console.error('[LOCATION] 유효하지 않은 좌표입니다 (0, 0). 지도 중심 이동을 건너뜁니다.');
                                return;
                              }
                              
                              if (!isMapInitialized) {
                                console.error('[LOCATION] 지도가 아직 초기화되지 않았습니다.');
                                return;
                              }
                              
                              if (!map.current) {
                                console.error('[LOCATION] 지도 객체가 없습니다.');
                                return;
                              }
                              
                              if (!window.naver?.maps) {
                                console.error('[LOCATION] 네이버 지도 API가 로드되지 않았습니다.');
                                return;
                              }
                              
                              try {
                                const position = new window.naver.maps.LatLng(lat, lng);
                                console.log(`[LOCATION] 생성된 LatLng 객체:`, position);
                                
                                // 지도 중심 이동
                                console.log(`[LOCATION] 지도 중심 이동 시작: lat=${lat}, lng=${lng}`);
                                map.current.setCenter(position);
                                
                                // 줌 레벨 설정
                                const currentZoom = map.current.getZoom();
                                if (currentZoom < 16) {
                                  map.current.setZoom(16);
                                  console.log(`[LOCATION] 줌 레벨 변경: ${currentZoom} → 16`);
                                }
                                
                                console.log(`[LOCATION] 지도 중심 이동 완료`);
                                
                                setNewLocation({ 
                                  id: location.slt_idx ? location.slt_idx.toString() : Date.now().toString(), 
                                  name: location.name || location.slt_title || '',
                                  address: location.address || location.slt_add || '',
                                  coordinates: [lng, lat],
                                  category: location.category || '기타',
                                  memo: location.memo || '',
                                  favorite: location.favorite || false,
                                  notifications: location.notifications || location.slt_enter_alarm === 'Y', 
                                });
                                setClickedCoordinates(position);
                                setIsEditingPanel(true); 
                                setIsLocationInfoPanelOpen(true);
                                
                                // 임시 마커 제거
                                if (tempMarker.current) {
                                  tempMarker.current.setMap(null);
                                  tempMarker.current = null;
                                }
                                
                                // 마커 재생성 (약간의 지연 후)
                                setTimeout(() => {
                                  console.log(`[LOCATION] 마커 재생성 시작, 장소 수: ${otherMembersSavedLocations.length}`);
                                  addMarkersToMapForOtherMembers(otherMembersSavedLocations);
                                }, 100);
                                
                              } catch (error) {
                                console.error('[LOCATION] 지도 중심 이동 중 오류:', error);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center min-w-0">
                                <FiMapPin className="w-3.5 h-3.5 text-purple-600 mr-1.5 flex-shrink-0" />
                                <h4 className="text-sm font-semibold text-gray-800 truncate">{location.name || location.slt_title || '제목 없음'}</h4>
                              </div>
                              {/* 알림 아이콘: location.notifications 또는 location.slt_enter_alarm 사용 */}
                              {(location.notifications || location.slt_enter_alarm === 'Y') ? (
                                <FiBell size={12} className="text-yellow-500 flex-shrink-0 ml-1" />
                              ) : (
                                <FiBellOff size={12} className="text-red-500 flex-shrink-0 ml-1" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-1 pl-[1.125rem]">{location.address || location.slt_add || '주소 정보 없음'}</p>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-500">
                      <p>{groupMembers.find(m => m.isSelected)?.name ? `${groupMembers.find(m => m.isSelected)?.name}님이 등록한 장소가 없습니다.` : '다른 멤버들이 등록한 장소가 없습니다.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* 스와이프 인디케이터 (점) */}
            <div className="flex justify-center items-center my-2">
                <button
                  onClick={() => handleViewChange('selectedMemberPlaces')}
                  className={`w-2.5 h-2.5 rounded-full mx-1.5 focus:outline-none ${
                    activeView === 'selectedMemberPlaces' ? 'bg-indigo-600 scale-110' : 'bg-gray-300'
                  } transition-all duration-300`}
                  aria-label="선택된 멤버 장소 뷰로 전환"
                />
                <button
                  onClick={() => handleViewChange('otherMembersPlaces')}
                  className={`w-2.5 h-2.5 rounded-full mx-1.5 focus:outline-none ${
                    activeView === 'otherMembersPlaces' ? 'bg-indigo-600 scale-110' : 'bg-gray-300'
                  } transition-all duration-300`}
                  aria-label="다른 멤버 장소 뷰로 전환"
                />
            </div>
          </div>
        </div>

        {isAddModalOpen && renderModal(
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 modal-content animate-scaleIn">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900 font-suite">새 위치 추가</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 -m-1"
              >
                <FiX size={20} />
              </button>
            </div>
            <form className="mt-4 space-y-4">
              <div>
                <label htmlFor="location-name" className="block text-sm font-medium text-gray-700">위치명</label>
                <input
                  type="text"
                  id="location-name"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label htmlFor="location-address" className="block text-sm font-medium text-gray-700">주소</label>
                <div className="flex items-center space-x-2">
                <input
                  type="text"
                  id="location-address"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                  required
                />
                  <Button type="button" variant="outline" onClick={() => handleOpenLocationSearchModalForModals("add")} className="mt-1 flex-shrink-0 p-2">
                    <FaSearchSolid />
                  </Button>
              </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                <Button type="button" onClick={handleAddLocation}>저장</Button>
              </div>
            </form>
          </div>
        )}

        {isEditModalOpen && newLocation.id && renderModal(
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 modal-content animate-scaleIn">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900 font-suite">위치 편집</h3>
                <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 -m-1"
                >
                <FiX size={20} />
                </button>
            </div>
            <form className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-location-name" className="block text-sm font-medium text-gray-700">위치명</label>
                <input
                  type="text"
                  id="edit-location-name"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.name} 
                  onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-location-address" className="block text-sm font-medium text-gray-700">주소</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    id="edit-location-address"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                    required
                  />
                  <Button type="button" variant="outline" onClick={() => handleOpenLocationSearchModalForModals("edit")} className="mt-1 flex-shrink-0 p-2">
                    <FaSearchSolid />
                  </Button>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>취소</Button>
                <Button type="button" onClick={handleSaveEditLocation}>저장</Button>
              </div>
            </form>
          </div>
        )}

        {isLocationSearchModalOpen && (locationSearchModalCaller === 'add' || locationSearchModalCaller === 'edit' || locationSearchModalCaller === 'panel') && renderModal( 
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-scaleIn flex flex-col max-h-[calc(100vh-8rem)] location-search-modal-content" onClick={(e) => e.stopPropagation()}> 
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">주소 검색</h3>
              <button onClick={handleCloseLocationSearchModal} className="text-gray-400 hover:text-gray-500"><FiX size={24} /></button>
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex items-center space-x-2 mb-4 flex-shrink-0">
                <input 
                  type="search" 
                  value={locationSearchQuery} 
                  onChange={(e) => setLocationSearchQuery(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchLocationInternal(locationSearchQuery)}
                  className="flex-grow w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border placeholder-gray-400" 
                  placeholder="도로명, 지번, 건물명 검색" 
                  autoFocus 
                />
                <Button 
                  type="button" 
                  variant="primary" 
                  onClick={() => handleSearchLocationInternal(locationSearchQuery)}
                  disabled={isSearchingLocation || isSearchingLocationForPanel} 
                  className="flex-shrink-0"
                >
                  {(isSearchingLocation || isSearchingLocationForPanel) ? '검색중...' : '검색'}
                </Button>
              </div>
              <div className="overflow-y-auto flex-grow">
                {(isSearchingLocation || isSearchingLocationForPanel) && <p className="text-center text-gray-500 py-4">검색 중...</p>}
                {!(isSearchingLocation || isSearchingLocationForPanel) && locationSearchResults.length === 0 && (<p className="text-center text-gray-500 py-4">검색 결과가 없습니다.</p>)}
                {!(isSearchingLocation || isSearchingLocationForPanel) && locationSearchResults.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mt-2 mb-1 px-1">검색 결과:</p>
                    <ul className="divide-y divide-gray-200">
                      {locationSearchResults.map((place) => (
                        <li key={place.temp_id || place.id} className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2" 
                          onClick={() => locationSearchModalCaller === 'panel' ? handleSelectLocationForPanel(place) : handleSelectLocationForModals(place)} >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{place.place_name}</p>
                            <p className="text-xs text-gray-500 truncate">{place.road_address_name || place.address_name}</p>
                          </div>
                          <Button type="button" variant="outline" size="sm" className="ml-3 flex-shrink-0">선택</Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>, 
          locationSearchModalCaller === 'panel' ? undefined : "location-search-modal-overlay"
        )}
      </PageContainer>
      <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
    </>
  );
} 