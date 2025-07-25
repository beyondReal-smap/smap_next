'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
// import mapboxgl from 'mapbox-gl'; // Mapbox 임포트 제거
// import 'mapbox-gl/dist/mapbox-gl.css'; // Mapbox CSS 제거
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiMapPin, FiChevronUp, FiChevronDown, FiX, FiLoader, FiBell, FiBellOff } from 'react-icons/fi'; // Added FiBell, FiBellOff
import { FaSearch as FaSearchSolid } from 'react-icons/fa'; // 주소 검색 아이콘 추가
import { toast, ToastContainer } from 'react-toastify'; // react-toastify 임포트
import 'react-toastify/dist/ReactToastify.css'; // react-toastify CSS 임포트
import Link from 'next/link'; // Link 임포트 추가
import LoadingSpinner from '../components/common/LoadingSpinner'; // LoadingSpinner 추가
// API_KEYS와 MAP_CONFIG를 config에서 가져오도록 수정
import { API_KEYS, MAP_CONFIG, KAKAO_SHARE } from '../../config'; 
import { PageContainer, Button } from '../components/layout'; // Button 컴포넌트 경로 복원
import ReactDOM from 'react-dom'; // Portal 사용 위해 추가
import memberService from '@/services/memberService'; // 멤버 서비스 추가
import locationService, { OtherMemberLocationRaw } from '@/services/locationService'; // locationService 임포트 추가
import groupService, { Group } from '@/services/groupService'; // 그룹 서비스 추가

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

// 바텀시트 위치 상수 정의
const BOTTOM_SHEET_POSITIONS = {
  COLLAPSED_HEIGHT: 100, // 접혔을 때 하단에서 올라온 높이
  EXPANDED_PERCENTAGE: 0.62, // 펼쳤을 때 CSS translateY(62%)와 일치
  TRANSITION_DURATION: '0.5s', // 0.4s에서 0.5s로 변경하여 home/page.tsx와 일치
  TRANSITION_TIMING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  MIN_DRAG_DISTANCE: 30 // 상태 전환을 위한 최소 드래그 거리를 30px로 변경
};

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
const MOCK_LOCATIONS: LocationData[] = [];

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
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.bottom-sheet-expanded {
  transform: translateY(62%); /* 58%에서 62%로 변경하여 10px 정도 덜 올라오도록 조정 */
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
  position: fixed; /* absolute에서 fixed로 변경하여 더 안정적으로 고정 */
  top: 70px; /* 헤더에서 10px 더 내려온 위치 (기존 60px에서 70px로 변경) */
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 30px);
  max-width: 450px; /* max-width를 조금 줄여서 여백 확보 */
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.2); /* 그림자를 더 진하게 해서 고정된 느낌 강화 */
  z-index: 60; /* z-index를 더 높여서 확실히 최상위에 표시 */
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) scale(0.95);
  transition: opacity 0.3s ease-out, visibility 0.3s ease-out, transform 0.3s ease-out;
  margin: 0; /* 여백 제거 */
  box-sizing: border-box; /* 박스 사이징 명시 */
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

// CSS 애니메이션 키프레임 스타일
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
  animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
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
  const dragStartTime = useRef<number | null>(null);
  const markers = useRef<{ [key: string]: NaverMarker }>({});
  const groupMemberMarkers = useRef<NaverMarker[]>([]); // 그룹 멤버 마커(네이버용)

  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces'); // activeView 상태 확장
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  const [locations, setLocations] = useState<LocationData[]>([]); // 목업 데이터 제거하고 빈 배열로 초기화
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
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null); // 선택된 마커 ID 상태 추가
  const selectedLocationIdRef = useRef<string | null>(null); // 선택 상태 보존용 ref 추가

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]); 
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[] | null>(null);
  const [otherMembersSavedLocations, setOtherMembersSavedLocations] = useState<OtherMemberLocationRaw[]>([]); // 다른 멤버들 장소 상태
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const dataFetchedRef = useRef<boolean>(false);
  const [isFetchingGroupMembers, setIsFetchingGroupMembers] = useState(false);
  const [isLoadingOtherLocations, setIsLoadingOtherLocations] = useState(false); // 로딩 상태 추가

  // 그룹 관련 상태 추가
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);

  const isDraggingRef = useRef(false);
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false); // 첫번째 멤버 선택 완료 상태 추가
  // 첫번째 멤버 선택 완료 여부를 추적하는 상태 추가
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);
  
  // 현재 선택된 멤버 ID를 추적하는 ref 추가
  const selectedMemberIdRef = useRef<string | null>(null);
  
  // 드래그 방향 감지용 ref 추가
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const startDragX = useRef<number | null>(null);

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

  // 그룹 선택 핸들러
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
    // 바텀시트를 collapsed 상태로 변경
    setBottomSheetState('collapsed');
    
    // 기존 멤버 데이터 초기화
    setGroupMembers([]);
    setSelectedMemberSavedLocations(null);
    setOtherMembersSavedLocations([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
    
    // selectedMemberIdRef도 초기화
    selectedMemberIdRef.current = null;
    
    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');
  };

  // 특정 그룹의 멤버 데이터 불러오기 함수 제거
  // 기본 fetchGroupMembersData 함수만 사용

  const fetchGroupMembersData = async () => {
    if (isFetchingGroupMembers) {
      console.log('[fetchGroupMembersData] 이미 로딩 중입니다. 중복 실행 방지.');
      return;
    }

    setIsFetchingGroupMembers(true);
    console.log('[fetchGroupMembersData] 시작');
    
    try {
      // 선택된 그룹이 있으면 해당 그룹의 멤버를 불러오고, 없으면 기본 그룹 사용
      const groupIdToUse = selectedGroupId ? selectedGroupId.toString() : '641';
      console.log('[fetchGroupMembersData] 사용할 그룹 ID:', groupIdToUse);
      
      const memberData = await memberService.getGroupMembers(groupIdToUse);
      console.log('[fetchGroupMembersData] API 응답:', memberData);

      if (memberData && memberData.length > 0) {
        const convertedMembers: GroupMember[] = memberData.map((member: any, index: number) => ({
            id: member.mt_idx.toString(),
            name: member.mt_name || `멤버 ${index + 1}`,
            photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `${BACKEND_STORAGE_BASE_URL}${member.mt_file1}`) : null,
            isSelected: false,
            location: { 
              lat: parseFloat(member.mt_lat || '37.5642') + (Math.random() * 0.01 - 0.005), 
              lng: parseFloat(member.mt_long || '127.0016') + (Math.random() * 0.01 - 0.005) 
            },
          schedules: [], 
          savedLocations: [],
            mt_gender: typeof member.mt_gender === 'number' ? member.mt_gender : null,
            original_index: index
        }));

        setGroupMembers(convertedMembers);
        console.log('[fetchGroupMembersData] 그룹멤버 설정 완료:', convertedMembers.length, '명');
      } else {
        console.warn('[fetchGroupMembersData] 그룹멤버 데이터가 없거나 비어있습니다.');
        setGroupMembers([]); 
        // 그룹멤버가 없으면 첫번째 멤버 선택 완료 상태를 true로 설정
        setIsFirstMemberSelectionComplete(true);
      }
    } catch (error) {
      console.error('[fetchGroupMembersData] 오류:', error);
      setGroupMembers([]); 
      // 오류 시에도 첫번째 멤버 선택 완료 상태를 true로 설정
      setIsFirstMemberSelectionComplete(true);
    } finally {
      setIsFetchingGroupMembers(false);
      setIsLoading(false); // 그룹멤버 렌더링을 위해 isLoading도 false로 설정
      console.log('[fetchGroupMembersData] 완료');
    }
  };

  useEffect(() => {
    if (isMapInitialized) {
      fetchGroupMembersData();
    }
  }, [isMapInitialized]); 

  // 컴포넌트 마운트 시 그룹 목록 불러오기
  useEffect(() => {
    if (isMapInitialized) {
      fetchUserGroups();
    }
  }, [isMapInitialized]);

  // 선택된 그룹이 변경될 때 멤버 데이터 불러오기
  useEffect(() => {
    if (isMapInitialized && selectedGroupId) {
      fetchGroupMembersData();
    }
  }, [isMapInitialized, selectedGroupId]);

  // 첫번째 멤버 자동 선택
  useEffect(() => {
    if (groupMembers.length > 0 && !groupMembers.some(m => m.isSelected) && isMapInitialized && !isFirstMemberSelectionComplete) {
      console.log('[LOCATION] 첫번째 멤버 자동 선택 시작:', groupMembers[0].name);
      console.log('[LOCATION] isFirstMemberSelectionComplete:', isFirstMemberSelectionComplete);
      
      // 상태를 즉시 설정하여 중복 실행 방지
      setFirstMemberSelected(true);
      
      setTimeout(() => {
        console.log('[LOCATION] 첫번째 멤버 자동 선택 실행:', groupMembers[0].id);
        handleMemberSelect(groupMembers[0].id);
      }, 500);
    }
  }, [groupMembers.length, isMapInitialized, isFirstMemberSelectionComplete]); // 의존성 배열 개선
    
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
    
  const loadNaverMapsAPI = () => {
    if (window.naver?.maps) {
      setNaverMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'naver-maps-script'; 
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAPS_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
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

          // 클릭한 지점으로 지도 중심 이동
          map.current.panTo(e.coord);
          console.log("[Map Click] 지도 중심을 클릭한 지점으로 이동:", e.coord.x, e.coord.y);

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
    console.log("[AutoSelect Effect] Triggered. isMapInitialized:", isMapInitialized, "groupMembers.length:", groupMembers.length, "isFetchingGroupMembers:", isFetchingGroupMembers, "firstMemberSelected:", firstMemberSelected);
    
    // 지도가 초기화되고, 그룹멤버 데이터가 로드되었으며, 현재 로딩 중이 아니고, 아직 첫 멤버 선택이 완료되지 않았을 때만 실행
    if (isMapInitialized && groupMembers.length > 0 && !isFetchingGroupMembers && !firstMemberSelected) {
      const isAnyMemberSelected = groupMembers.some(m => m.isSelected);
      console.log("[AutoSelect Effect] Conditions met. isAnyMemberSelected:", isAnyMemberSelected);
      
      if (!isAnyMemberSelected) { 
        console.log("[LocationPage] Map initialized and group members ready. Auto-selecting first member:", groupMembers[0].name);
        console.log("[LocationPage] First member savedLocations count:", groupMembers[0].savedLocations?.length || 0);
        
        // 첫번째 멤버 선택 상태를 즉시 true로 설정하여 중복 실행 방지
        setFirstMemberSelected(true);
        
        // 첫번째 멤버 선택 (약간의 지연을 두어 UI 업데이트가 완료된 후 실행)
        setTimeout(() => {
          if (groupMembers[0] && groupMembers[0].id) {
            handleMemberSelect(groupMembers[0].id, false); 
          }
        }, 500);
      }
    } 
  }, [isMapInitialized, groupMembers.length, isFetchingGroupMembers, firstMemberSelected]); // groupMembers 전체 객체를 제거하고 length만 유지
  
  const getBottomSheetClassName = () => {
    // 로딩 중일 때는 강제로 collapsed 상태로 유지
    if (isMapLoading || isFetchingGroupMembers || !isFirstMemberSelectionComplete) {
      return 'bottom-sheet-collapsed';
    }
    
    switch (bottomSheetState) {
      case 'collapsed': return 'bottom-sheet-collapsed';
      case 'expanded': return 'bottom-sheet-expanded';
      default: return 'bottom-sheet-collapsed';
    }
  };
  const handleDragStart = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    startDragY.current = clientY;
    startDragX.current = clientX;
    isDraggingRef.current = true;
    dragStartTime.current = Date.now();
    isHorizontalSwipeRef.current = null; // 방향 판단 초기화

    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || startDragY.current === null || startDragX.current === null) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    // 방향이 아직 결정되지 않았다면 방향을 판단
    if (isHorizontalSwipeRef.current === null) {
      const deltaX = Math.abs(clientX - startDragX.current);
      const deltaY = Math.abs(clientY - startDragY.current);
      
      // 움직임이 5px 이상일 때 즉시 방향 판단
      if (deltaX >= 5 || deltaY >= 5) {
        // 더 명확한 방향 판단: 1.5배 이상 차이날 때만 해당 방향으로 확정
        if (deltaX > deltaY * 1.5) {
          isHorizontalSwipeRef.current = true; // 좌우 스와이프
        } else if (deltaY > deltaX * 1.5) {
          isHorizontalSwipeRef.current = false; // 상하 드래그
        }
      }
    }
    
    // 방향이 아직 결정되지 않았다면 더 기다림
    if (isHorizontalSwipeRef.current === null) {
      return;
    }
    
    // 좌우 스와이프: 상하 드래그와 동일한 패턴으로 즉시 전환
    if (isHorizontalSwipeRef.current === true) {
      const deltaX = clientX - startDragX.current;
      
      // 최소 스와이프 거리 체크 (30px 이상 움직여야 함)
      const minSwipeDistance = 30;
      if (Math.abs(deltaX) < minSwipeDistance) return;

      // 스와이프 방향에 따라 다음 뷰 결정
      let nextView: 'selectedMemberPlaces' | 'otherMembersPlaces' = activeView;
      
      if (deltaX < 0) { // 왼쪽으로 스와이프 (음수) -> 다음 뷰
        if (activeView === 'selectedMemberPlaces') {
          nextView = 'otherMembersPlaces';
        }
        // otherMembersPlaces에서 왼쪽 스와이프하면 그대로 유지
      } else { // 오른쪽으로 스와이프 (양수) -> 이전 뷰
        if (activeView === 'otherMembersPlaces') {
          nextView = 'selectedMemberPlaces';
        }
        // selectedMemberPlaces에서 오른쪽 스와이프하면 그대로 유지
      }

      // 뷰가 변경되면 즉시 적용하고 드래그 종료
      if (nextView !== activeView) {
        console.log('[SWIPE] 좌우 스와이프로 뷰 변경:', activeView, '→', nextView);
        setActiveView(nextView);
        
        // 드래그 종료 처리
        startDragY.current = null;
        startDragX.current = null;
        isDraggingRef.current = false;
        dragStartTime.current = null;
        isHorizontalSwipeRef.current = null;
      }
      return;
    }
    
    // 상하 드래그: home/page.tsx와 동일한 로직 적용
    const deltaY = clientY - startDragY.current;
    
    // 최소 드래그 거리 체크 (30px 이상 움직여야 함)
    const minDragDistance = 30;
    if (Math.abs(deltaY) < minDragDistance) return;

    // 드래그 방향에 따라 다음 상태 결정 (2개 상태만 사용)
    let nextState: 'collapsed' | 'expanded' = bottomSheetState;
    
    if (deltaY < 0) { // 위로 드래그 (음수)
      if (bottomSheetState === 'collapsed') {
        nextState = 'expanded';
      }
      // expanded에서 위로 드래그하면 그대로 유지
    } else { // 아래로 드래그 (양수)
      if (bottomSheetState === 'expanded') {
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
      startDragX.current = null;
      isDraggingRef.current = false;
      dragStartTime.current = null;
      isHorizontalSwipeRef.current = null;
    }
  };

  const handleDragEnd = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    // 멤버 선택 버튼이나 기타 인터랙티브 요소에서 시작된 이벤트는 무시
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    
    if (!isDraggingRef.current || startDragY.current === null) return;

    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const deltaY = clientY - startDragY.current;
    const deltaX = clientX - (startDragX.current || 0);
    const deltaTime = dragStartTime.current ? Date.now() - dragStartTime.current : 0;
    
    // 드래그가 아닌 탭 동작인 경우 (짧은 시간 + 작은 움직임)
    const isTap = Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10 && deltaTime < 200;
    
    // 좌우 스와이프였지만 거리가 부족한 경우 탭으로 처리
    if (isHorizontalSwipeRef.current === true) {
      if (isTap) {
        // 탭 동작: 다음 뷰로 전환 (selectedMemberPlaces -> otherMembersPlaces만)
        if (activeView === 'selectedMemberPlaces') {
          console.log('[SWIPE] 탭으로 뷰 변경:', activeView, '→', 'otherMembersPlaces');
          setActiveView('otherMembersPlaces');
        }
        // otherMembersPlaces에서 탭하면 그대로 유지 (뒤로 가지 않음)
      }
      
      // 스타일 복원
      if (bottomSheetRef.current) {
        bottomSheetRef.current.style.transition = `transform ${BOTTOM_SHEET_POSITIONS.TRANSITION_DURATION} ${BOTTOM_SHEET_POSITIONS.TRANSITION_TIMING}`;
      }
      
      startDragY.current = null;
      startDragX.current = null;
      isDraggingRef.current = false;
      dragStartTime.current = null;
      isHorizontalSwipeRef.current = null;
      return;
    }

    // 상하 드래그에 대한 탭 처리
    if (isTap) {
      // 탭 동작: collapsed에서만 expanded로 전환
      if (bottomSheetState === 'collapsed') {
        console.log('[BOTTOM_SHEET] 탭으로 상태 변경:', bottomSheetState, '→', 'expanded');
        setBottomSheetState('expanded');
      }
      // expanded에서 탭하면 그대로 유지
    }

    // 스타일 복원
    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = `transform ${BOTTOM_SHEET_POSITIONS.TRANSITION_DURATION} ${BOTTOM_SHEET_POSITIONS.TRANSITION_TIMING}`;
    }

    startDragY.current = null;
    startDragX.current = null;
    isDraggingRef.current = false;
    dragStartTime.current = null;
    isHorizontalSwipeRef.current = null;
  };
  const toggleBottomSheet = () => {
    const newState = bottomSheetState === 'collapsed' ? 'expanded' : 'collapsed';
    setBottomSheetState(newState);
    if (newState === 'collapsed') {
      setIsLocationInfoPanelOpen(false);
      if (tempMarker.current) {
        tempMarker.current.setMap(null);
      }
      setIsEditingPanel(false);
      // 마커 색상 리셋
      setTimeout(() => {
        updateMarkerSelection(null);
      }, 100);
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
      // 마커 색상 리셋
      setTimeout(() => {
        updateMarkerSelection(null);
      }, 100);
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

  // 공통 마커 생성 함수 - 선택 상태 관리 개선
  const createMarker = (
    location: any, 
    index: number, 
    markerType: 'selected' | 'other',
    selectedMarkerId?: string
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
    
    // 선택 상태 확인 - selectedLocationId 상태를 우선 확인하고, 그 다음 정보 패널 상태 확인
    const isSelectedByState = selectedLocationId === locationId;
    const isSelectedByInfoPanel = isLocationInfoPanelOpen && isEditingPanel && newLocation.id === locationId;
    const isSelected = isSelectedByState || isSelectedByInfoPanel;
    
    // 마커 색상 설정 - 선택된 경우만 핑크색, 나머지는 모두 인디고
    const bgColor = isSelected ? '#EC4899' : '#4F46E5'; 
    const dotColor = isSelected ? '#EC4899' : '#4F46E5';
    
    console.log(`[createMarker] 마커 생성: ${title} at (${lat}, ${lng}), type: ${markerType}, selected: ${isSelected} (state: ${isSelectedByState}, panel: ${isSelectedByInfoPanel}), locationId: ${locationId}`);

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

    markerInstance.setZIndex(isSelected ? 200 : 100);

    // 마커 클릭 이벤트 - 마커 재생성 로직 제거
    window.naver.maps.Event.addListener(markerInstance, 'click', () => {
      console.log(`[createMarker] 마커 클릭됨: ${title}, ID: ${locationId}`);
      
      const clickedData = markerType === 'selected' 
        ? (locations.find(l => l.id === locationId) || selectedMemberSavedLocations?.find(l => l.id === locationId))
        : otherMembersSavedLocations?.find(l => (l.id === locationId || (l.slt_idx && l.slt_idx.toString() === locationId)));
      
            setNewLocation({ 
        id: locationId,
        name: title,
        address: location.address || location.slt_add || '주소 정보 없음',
        coordinates: [lng, lat],
        category: clickedData?.category || location.category || '기타',
        memo: clickedData?.memo || location.memo || '',
        favorite: clickedData?.favorite || location.favorite || false,
        notifications: (() => {
          // 현재 상태에서 해당 장소의 최신 알림 상태를 찾기
          if (markerType === 'selected') {
            // selectedMemberSavedLocations에서 먼저 찾기
            const updatedSelectedLocation = selectedMemberSavedLocations?.find(l => l.id === locationId);
            if (updatedSelectedLocation) {
              return updatedSelectedLocation.notifications || false;
            }
            
            // 기본 locations에서 찾기
            const updatedLocation = locations.find(l => l.id === locationId);
            if (updatedLocation) {
              return updatedLocation.notifications || false;
            }
          } else {
            // otherMembersSavedLocations에서 찾기
            const updatedOtherLocation = otherMembersSavedLocations?.find(l => 
              (l.id === locationId || (l.slt_idx && l.slt_idx.toString() === locationId))
            );
            if (updatedOtherLocation) {
              return updatedOtherLocation.notifications !== undefined 
                ? updatedOtherLocation.notifications 
                : updatedOtherLocation.slt_enter_alarm === 'Y';
            }
          }
          
          // 기본값으로 clickedData에서 가져오거나 원본 데이터 사용
          return clickedData?.notifications || location.notifications || location.slt_enter_alarm === 'Y' || false;
        })(),
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
      
      // 선택된 마커 색상 변경 - setTimeout 제거하고 즉시 실행
      setSelectedLocationId(locationId); // 선택된 마커 ID 업데이트
      selectedLocationIdRef.current = locationId; // ref도 함께 업데이트
      updateMarkerSelection(locationId);
    });
    
    return { marker: markerInstance, id: `${locationId}_${index}` };
  };

  const addMarkersToMap = (locationsToDisplay: LocationData[], selectedMarkerId?: string) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) {
      console.log('[addMarkersToMap] 지도 또는 네이버 API가 준비되지 않음');
      return;
    }
    
    console.log(`[addMarkersToMap] ${locationsToDisplay.length}개의 장소에 대한 마커 생성 시작, selectedMarkerId: ${selectedMarkerId}`);

    // 기존 마커 즉시 제거
    Object.values(markers.current).forEach(marker => {
      if (marker && typeof marker.setMap === 'function') marker.setMap(null);
    });
    markers.current = {};

    if (!locationsToDisplay || locationsToDisplay.length === 0) {
      console.log('[addMarkersToMap] 표시할 장소가 없음');
      return;
    }

    // 새 마커 즉시 생성
    locationsToDisplay.forEach((location, index) => {
      if (!location.id) {
        console.warn('[addMarkersToMap] Location ID가 없습니다. 마커를 생성할 수 없습니다:', location);
        return;
      }
      
      const markerResult = createMarker(location, index, 'selected', selectedMarkerId);
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
        addMarkersToMapForOtherMembers(newOtherMembersSavedLocations, selectedLocationId || undefined);
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
            addMarkersToMap(listToUpdate.map(loc => loc.id === currentIdStr ? updatedLocationData : loc), selectedLocationId || undefined);
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

    // 모든 그룹멤버에 대해 마커 생성
    members.forEach(member => {
      try {
        const photoForMarker = member.photo ?? getDefaultImage(member.mt_gender, member.original_index); 
        const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
        // 선택된 멤버는 핑크색 외곽선, 일반 멤버는 인디고 외곽선
        const borderColor = member.isSelected ? '#EC4899' : '#4F46E5';
        
        const markerInstance = new window.naver.maps.Marker({
          position: position,
          map: map.current,
          icon: {
            content: `
              <div style="position: relative; text-align: center;">
                <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
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
          zIndex: member.isSelected ? 200 : 150 // 선택된 멤버가 위에 표시되도록
        });
        newMemberMarkers.push(markerInstance);
      } catch (error) {
        console.error(`멤버 마커 생성 오류 (${member.name}):`, error);
      }
    });

    groupMemberMarkers.current = newMemberMarkers;

    // 선택된 멤버가 있으면 해당 위치로 지도 이동
    const selectedMember = members.find(member => member.isSelected);
    if (selectedMember) {
      if (map.current && selectedMember.location) {
        const position = new window.naver.maps.LatLng(selectedMember.location.lat, selectedMember.location.lng);
        map.current.panTo(position); 
        if (map.current.getZoom() < 16) {
           map.current.setZoom(16);
        }
      }
    } else if (members.length > 0) {
      // 선택된 멤버가 없으면 모든 멤버가 보이도록 지도 조정
      const validMembers = members.filter(member => 
        member.location && 
        member.location.lat && 
        member.location.lng
      );
      
      if (validMembers.length > 0 && map.current) {
        const bounds = new window.naver.maps.LatLngBounds();
        validMembers.forEach(member => {
            bounds.extend(new window.naver.maps.LatLng(member.location.lat, member.location.lng));
        });
        
        // 유효한 멤버가 있으면 bounds 적용 (isEmpty 체크 제거)
        map.current.fitBounds(bounds, {
          padding: { top: 50, right: 50, bottom: 50, left: 50 }
        });
      }
    }
  };

  const handleMemberSelect = async (memberId: string, openLocationPanel = false) => { 
    console.log('[handleMemberSelect] 멤버 선택:', memberId, '패널 열기:', openLocationPanel);
    
    // 드래그 상태 강제 리셋 (멤버 선택 시 바텀시트 상태 변경 방지)
    isDraggingRef.current = false;
    startDragY.current = null;
    startDragX.current = null;
    dragStartTime.current = null;
    isHorizontalSwipeRef.current = null;
    
    // 이미 선택된 멤버라면 중복 실행 방지 (상태 기반 체크만 사용)
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    if (currentSelectedMember && currentSelectedMember.id === memberId) {
      console.log('[handleMemberSelect] 이미 선택된 멤버입니다. 중복 실행 방지');
      // 이미 선택된 멤버이지만 첫번째 선택 완료 상태는 설정
      if (!isFirstMemberSelectionComplete) {
        setIsFirstMemberSelectionComplete(true);
        console.log('[handleMemberSelect] 첫번째 멤버 선택 완료 (중복 체크)');
      }
      return;
    }
    
    // selectedMemberIdRef 업데이트
    selectedMemberIdRef.current = memberId;
    
    const updatedMembers = groupMembers.map(member => {
      if (member.id === memberId) {
        return { ...member, isSelected: true };
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
      
      // 첫번째 멤버 선택 완료 상태 설정
      if (!isFirstMemberSelectionComplete) {
        setIsFirstMemberSelectionComplete(true);
        console.log('[handleMemberSelect] 첫번째 멤버 선택 완료');
      }
      
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
          notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined),
          slt_enter_alarm: loc.notifications ? 'Y' : 'N'
        }));
        setOtherMembersSavedLocations(rawLocationsForOtherMembers);
        
        // activeView 설정
        setActiveView('selectedMemberPlaces');
        
        // 즉시 마커 생성 - setTimeout 제거
        addMarkersToMap(newlySelectedMember.savedLocations, selectedLocationId || undefined);
        console.log('[handleMemberSelect] 기존 장소로 마커 즉시 생성:', newlySelectedMember.savedLocations.length, '개');
        
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
            notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined),
            slt_enter_alarm: loc.notifications ? 'Y' : 'N'
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
          
          // 즉시 마커 생성 - setTimeout 제거
          addMarkersToMap(convertedLocations, selectedLocationId || undefined);
          console.log('[handleMemberSelect] API 조회 장소로 마커 즉시 생성:', convertedLocations.length, '개');
          
        } catch (error) {
          console.error("Failed to fetch selected member's locations in handleMemberSelect:", error);
          setSelectedMemberSavedLocations([]);
          setOtherMembersSavedLocations([]);
          setActiveView('selectedMemberPlaces');
          
          // 오류 시 빈 마커 즉시 생성
          addMarkersToMap([], selectedLocationId || undefined);
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
      addMarkersToMap(locations, selectedLocationId || undefined); 
      setIsLocationInfoPanelOpen(false); 
      setIsEditingPanel(false);
      
      // 첫번째 멤버 선택 완료 상태 설정 (실패한 경우에도)
      if (!isFirstMemberSelectionComplete) {
        setIsFirstMemberSelectionComplete(true);
        console.log('[handleMemberSelect] 첫번째 멤버 선택 완료 (실패)');
      }
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
          // 즉시 마커 업데이트 - setTimeout 제거
          addMarkersToMapForOtherMembers(fetchedLocationsRaw, selectedLocationId || undefined);
        } catch (error) {
          console.error("Failed to fetch other members' locations on view change", error);
          setOtherMembersSavedLocations([]);
          addMarkersToMapForOtherMembers([], selectedLocationId || undefined);
        } finally {
          setIsLoadingOtherLocations(false);
        }
      } else if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
          // 즉시 마커 업데이트 - setTimeout 제거
          addMarkersToMap(selectedMemberSavedLocations || currentSelectedMember.savedLocations || [], selectedLocationId || undefined);
      } else if (!currentSelectedMember) {
          addMarkersToMap(locations, selectedLocationId || undefined);
      }
    };

    if (isMapInitialized) { 
        fetchOtherLocationsAndUpdateMarkers();
    }
  }, [isMapInitialized, activeView]); // groupMembers 의존성 제거하여 중복 실행 방지

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
        setIsEditingPanel(false);
        
        // 선택 상태 유지 - updateMarkerSelection(null) 제거
        // 마커는 핑크색 상태를 유지
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
  }, [isLocationInfoPanelOpen]); // 의존성 단순화

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
    
    // 즉시 마커 업데이트 - setTimeout 제거
    const currentSelectedMember = groupMembers.find(m => m.isSelected);

    if (newView === 'selectedMemberPlaces') {
      if (currentSelectedMember) {
        const locationsToShow = selectedMemberSavedLocations || currentSelectedMember.savedLocations || [];
        addMarkersToMap(locationsToShow, selectedLocationId || undefined);
      } else {
        addMarkersToMap(locations, selectedLocationId || undefined);
      }
    } else if (newView === 'otherMembersPlaces') {
      if (otherMembersSavedLocations.length > 0) {
        addMarkersToMapForOtherMembers(otherMembersSavedLocations, selectedLocationId || undefined);
      } else {
        addMarkersToMapForOtherMembers([], selectedLocationId || undefined);
      }
    }
  };

  // handleSwipeScroll 함수 비활성화 - 드래그 기반 뷰 전환으로 대체됨
  // const handleSwipeScroll = () => {
  //   if (swipeContainerRef.current) {
  //     const { scrollLeft, clientWidth, scrollWidth } = swipeContainerRef.current;
  //     // 현재 스크롤 위치가 전체 스크롤 가능 너비의 중간을 넘었는지 여부로 판단
  //     // (자식 요소가 2개라고 가정)
  //     if (scrollWidth > clientWidth) { // 스크롤 가능한 경우에만
  //       if (scrollLeft >= (scrollWidth - clientWidth) / 2 && activeView !== 'otherMembersPlaces') {
  //         handleViewChange('otherMembersPlaces');
  //       } else if (scrollLeft < (scrollWidth - clientWidth) / 2 && activeView !== 'selectedMemberPlaces') {
  //         handleViewChange('selectedMemberPlaces');
  //       }
  //     }
  //   }
  // };

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
    
    // 마커 재생성은 즉시 실행 - setTimeout 제거
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
    if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
        const updatedSavedLocations = (selectedMemberSavedLocations || currentSelectedMember.savedLocations || []).filter(loc => loc.id !== idStr);
          addMarkersToMap(updatedSavedLocations, selectedLocationId || undefined);
    } else if (activeView === 'otherMembersPlaces' && !isNaN(idNum)){
          addMarkersToMapForOtherMembers(otherMembersSavedLocations.filter(loc => loc.slt_idx !== idNum), selectedLocationId || undefined);
    } else { 
          addMarkersToMap(locations.filter(loc => loc.id !== idStr), selectedLocationId || undefined);
    }
  };
  
  // 다른 멤버의 위치 데이터를 위한 함수 개선
  const addMarkersToMapForOtherMembers = (locationsToDisplay: any[], selectedMarkerId?: string) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) {
      console.log('[addMarkersToMapForOtherMembers] 지도 또는 네이버 API가 준비되지 않음');
      return;
    }
    
    console.log('[addMarkersToMapForOtherMembers] 기존 마커 제거 시작');
    // 기존 마커 즉시 제거
    Object.values(markers.current).forEach(marker => {
      if (marker && typeof marker.setMap === 'function') marker.setMap(null);
    });
    markers.current = {};

    if (!locationsToDisplay || locationsToDisplay.length === 0) {
      console.log('[addMarkersToMapForOtherMembers] 표시할 장소가 없음');
      return;
    }

    console.log(`[addMarkersToMapForOtherMembers] ${locationsToDisplay.length}개의 장소에 대한 마커 생성 시작, selectedMarkerId: ${selectedMarkerId}`);

    // 새 마커 즉시 생성
    locationsToDisplay.forEach((location, index) => {
      const markerResult = createMarker(location, index, 'other', selectedMarkerId);
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

  // 선택된 마커만 업데이트하는 함수 추가
  const updateMarkerSelection = (selectedLocationId: string | null) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) return;
    
    console.log(`[updateMarkerSelection] 선택된 마커 업데이트: ${selectedLocationId}`);
    
    // 모든 마커의 색상을 인디고로 변경
    Object.entries(markers.current).forEach(([markerId, marker]) => {
      const locationId = markerId.split('_')[0]; // 마커 ID에서 실제 location ID 추출
      const isSelected = selectedLocationId === locationId;
      
      const bgColor = isSelected ? '#EC4899' : '#4F46E5';
      const dotColor = isSelected ? '#EC4899' : '#4F46E5';
      
      // 마커 제목 가져오기
      const title = marker.getTitle() || '제목 없음';
      
      const markerContent = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="padding: 3px 7px; background-color: ${bgColor}; color: white; border-radius: 5px; font-size: 11px; font-weight: normal; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); margin-bottom: 3px;">
                ${title}
              </div>
          <div style="width: 12px; height: 12px; background-color: ${dotColor}; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          </div>
        </div>
      `;
      
      marker.setIcon({
        content: markerContent,
        anchor: new window.naver.maps.Point(6, 38)
      });
      
      marker.setZIndex(isSelected ? 200 : 100);
    });
  };

  // 그룹멤버 데이터 변경 시 마커 업데이트
  useEffect(() => {
    if (
      groupMembers.length > 0 &&
      map.current && 
      window.naver?.maps && 
      naverMapsLoaded &&
      firstMemberSelected // 첫 번째 멤버 선택이 완료된 후에만 실행
    ) {
      console.log('[LOCATION] 그룹멤버 데이터 변경 감지 - 마커 업데이트:', groupMembers.length, '명');
      updateMemberMarkers(groupMembers);
    }
  }, [groupMembers.length, naverMapsLoaded, firstMemberSelected]); // groupMembers 객체 전체 대신 length만 의존성으로 사용

  // 외부 클릭 이벤트 리스너 설정
  useEffect(() => {
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
        setIsEditingPanel(false);
        
        // 선택 상태 유지 - updateMarkerSelection(null) 제거
        // 마커는 핑크색 상태를 유지
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
  }, [isLocationInfoPanelOpen]); // 의존성 단순화

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <style jsx global>{modalAnimation}</style>
      <PageContainer 
        title="내 장소" 
        showHeader={false} 
        showBackButton={false}
        className="p-0 m-0 w-full h-screen overflow-hidden relative animate-fadeIn"
      >
        {/* 전체화면 로딩 - 지도 로딩, 그룹멤버 로딩, 첫번째 멤버 선택 완료까지 */}
        {(isMapLoading || isFetchingGroupMembers || !isFirstMemberSelectionComplete) && (
          <LoadingSpinner 
            message={
              isMapLoading 
                ? "지도를 불러오는 중입니다..." 
                : isFetchingGroupMembers 
                  ? "데이터를 불러오는 중입니다..."
                  : "첫번째 멤버 위치로 이동 중입니다..."
            } 
            fullScreen={true}
            type="ripple"
            size="md"
            color="blue"
          />
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      const newNotificationStatus = !newLocation.notifications;
                        const locationIdStr = newLocation.id;
                        
                      console.log('[알림 토글] 시작:', locationIdStr, '→', newNotificationStatus, 'selectedLocationId:', selectedLocationId);
                      
                      // 1. 즉시 UI만 업데이트 (패널의 알림 버튼)
                      setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
                      
                      // 2. 나머지 상태 업데이트는 완전히 지연시켜서 현재 렌더링에 영향 없도록 함
                      if (locationIdStr) {
                        // 2초 후에 백그라운드 상태 업데이트 (UI에 영향 없음)
                        setTimeout(() => {
                          console.log('[알림 토글] 백그라운드 상태 업데이트 시작');
                          
                          // 다른 멤버 위치 데이터만 조건부 업데이트
                        const otherMemberLoc = getOtherMemberLocationById(locationIdStr, otherMembersSavedLocations);
                        if (otherMemberLoc) {
                            setOtherMembersSavedLocations(prev => prev.map(loc => 
                              loc.slt_idx === otherMemberLoc.slt_idx 
                                ? { ...loc, slt_enter_alarm: newNotificationStatus ? 'Y' : 'N', notifications: newNotificationStatus } 
                                : loc
                            ));
                          }
                          
                          // 현재 뷰에 따라서만 필요한 상태 업데이트
                          if (activeView === 'selectedMemberPlaces') {
                            setSelectedMemberSavedLocations(prev => 
                              prev ? prev.map(loc => 
                              loc.id === locationIdStr ? { ...loc, notifications: newNotificationStatus } : loc
                              ) : null
                            );
                          }
                          
                          console.log('[알림 토글] 백그라운드 상태 업데이트 완료');
                        }, 200); // 200ms로 단축하여 빠른 반영
                      }
                      
                      console.log('[알림 토글] 즉시 완료. selectedLocationId 절대 변경 안됨:', selectedLocationId);
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
                  // 선택 상태 유지 - 선택된 마커 ID와 색상 유지
                  // setSelectedLocationId(null) 및 updateMarkerSelection(null) 제거
                  const currentSelectedMember = groupMembers.find(m => m.isSelected);
                  if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
                      addMarkersToMap(currentSelectedMember.savedLocations || [], selectedLocationId || undefined);
                  } else if (activeView === 'otherMembersPlaces'){
                      addMarkersToMapForOtherMembers(otherMembersSavedLocations, selectedLocationId || undefined);
                  } else if (!currentSelectedMember) {
                      addMarkersToMap(locations, selectedLocationId || undefined);
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
                          // 선택 상태 유지 - 선택된 마커 ID와 색상 유지
                          // setSelectedLocationId(null) 및 updateMarkerSelection(null) 제거
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
                    <FiLoader className="absolute left-3 top-2 text-gray-400 animate-spin" style={{ marginTop: '4px' }} />
                  ) : (
                    <FaSearchSolid className="absolute left-3 top-2 text-gray-400 cursor-pointer" style={{ marginTop: '4px' }} onClick={handlePanelAddressSearch} />
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
                    // 선택 상태 유지 - 선택된 마커 ID와 색상 유지
                    // setSelectedLocationId(null) 및 updateMarkerSelection(null) 제거
                  }} className="flex-1">닫기</Button>
                  <Button variant="primary" onClick={handleConfirmPanelAction} className="flex-1" disabled={isSavingLocationPanel}>
                    {isSavingLocationPanel ? '저장 중...' : "내 장소 등록"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Sheet - 로딩 중이 아닐 때만 렌더링 */}
        {!(isMapLoading || isFetchingGroupMembers || !isFirstMemberSelectionComplete) && (
        <div
          ref={bottomSheetRef}
          className={`bottom-sheet ${getBottomSheetClassName()} hide-scrollbar`}
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
          <div className="px-4 pb-4">
            <div
              ref={swipeContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
            >
              <div className="w-full flex-shrink-0 snap-start">
                 <div className="content-section members-section min-h-[180px] max-h-[180px] overflow-y-auto">
                   <h2 className="text-lg font-medium text-gray-900 flex justify-between items-center section-title">
                       <div className="flex items-center space-x-3">
                         <span>그룹 멤버</span>
                         {isFetchingGroupMembers && <FiLoader className="animate-spin text-indigo-500" size={18}/>}
                       </div>
                       
                       <div className="flex items-center space-x-2">
                         {/* 그룹 선택 드롭다운 */}
                         <div className="relative">
                           <button
                             onClick={() => setIsGroupSelectorOpen(!isGroupSelectorOpen)}
                             className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-50 border border-gray-200 rounded text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
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
                                 <FiLoader className="animate-spin text-gray-400" size={12} />
                               ) : (
                                 <FiChevronDown className={`text-gray-400 transition-transform duration-200 ${isGroupSelectorOpen ? 'rotate-180' : ''}`} size={12} />
                               )}
                             </div>
                           </button>

                           {isGroupSelectorOpen && userGroups.length > 0 && (
                             <div className="absolute top-full right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto min-w-[160px]">
                               {userGroups.map((group) => (
                                 <button
                                   key={group.sgt_idx}
                                   onClick={() => handleGroupSelect(group.sgt_idx)}
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
                       className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-50 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                     >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                          </svg>
                       그룹 관리
                     </Link>
                       </div>
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
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleMemberSelect(member.id);
                               }}
                               onTouchStart={(e) => e.stopPropagation()}
                               onTouchMove={(e) => e.stopPropagation()}
                               onTouchEnd={(e) => e.stopPropagation()}
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
                              className={`flex-shrink-0 w-48 bg-white rounded-lg p-3.5 cursor-pointer transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 ${
                                (selectedLocationId === (location.slt_idx ? location.slt_idx.toString() : location.id) || 
                                 selectedLocationIdRef.current === (location.slt_idx ? location.slt_idx.toString() : location.id))
                                  ? 'shadow-xl ring-1 ring-indigo-300 ring-opacity-20 scale-105' 
                                  : 'shadow hover:shadow-lg'
                              }`}
                              style={{
                                // 인라인 스타일로도 선택 효과 강화
                                ...((selectedLocationId === (location.slt_idx ? location.slt_idx.toString() : location.id) || 
                                    selectedLocationIdRef.current === (location.slt_idx ? location.slt_idx.toString() : location.id))
                                  ? {
                                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 2px rgb(99 102 241 / 0.5)',
                                      transform: 'translateY(-3px) scale(1.02)',
                                    }
                                  : {})
                              }}
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
                                  
                                  const currentSelectedId = location.slt_idx ? location.slt_idx.toString() : (location.id || Date.now().toString());
                                
                                setNewLocation({ 
                                    id: currentSelectedId,
                                  name: location.name || location.slt_title || '',
                                  address: location.address || location.slt_add || '',
                                  coordinates: [lng, lat],
                                  category: location.category || '기타',
                                  memo: location.memo || '',
                                  favorite: location.favorite || false,
                                    notifications: (() => {
                                      // 현재 상태에서 해당 장소의 최신 알림 상태를 찾기
                                      const locationId = location.slt_idx ? location.slt_idx.toString() : (location.id || Date.now().toString());
                                      
                                      // otherMembersSavedLocations에서 찾기 (우선순위)
                                      const updatedOtherLocation = otherMembersSavedLocations.find(loc => 
                                        loc.slt_idx === location.slt_idx || loc.id === locationId
                                      );
                                      if (updatedOtherLocation) {
                                        return updatedOtherLocation.notifications !== undefined 
                                          ? updatedOtherLocation.notifications 
                                          : updatedOtherLocation.slt_enter_alarm === 'Y';
                                      }
                                      
                                      // selectedMemberSavedLocations에서 찾기
                                      const updatedSelectedLocation = selectedMemberSavedLocations?.find(loc => 
                                        loc.id === locationId
                                      );
                                      if (updatedSelectedLocation) {
                                        return updatedSelectedLocation.notifications || false;
                                      }
                                      
                                      // 기본 locations에서 찾기
                                      const updatedLocation = locations.find(loc => loc.id === locationId);
                                      if (updatedLocation) {
                                        return updatedLocation.notifications || false;
                                      }
                                      
                                      // 모든 곳에서 찾을 수 없으면 원본 데이터 사용
                                      return location.notifications !== undefined 
                                        ? location.notifications 
                                        : ((location as any).slt_enter_alarm === 'Y' || (location as any).slt_enter_alarm === undefined);
                                    })()
                                });
                                setClickedCoordinates(position);
                                setIsEditingPanel(true); 
                                setIsLocationInfoPanelOpen(true);
                                
                                // 임시 마커 제거
                                if (tempMarker.current) {
                                  tempMarker.current.setMap(null);
                                  tempMarker.current = null;
                                }
                                
                                  // 선택된 장소 ID 설정 (바텀시트 스타일 업데이트용)
                                  setSelectedLocationId(currentSelectedId);
                                  selectedLocationIdRef.current = currentSelectedId; // ref도 함께 업데이트
                                  console.log(`[LOCATION] 바텀시트에서 선택된 장소 ID 설정: ${currentSelectedId}`);
                                  
                                  // 선택된 마커 색상 변경 - 지연 시간 제거하여 즉시 실행
                                  console.log(`[LOCATION] 바텀시트에서 선택된 장소의 마커 색상 변경: ${currentSelectedId}`);
                                  updateMarkerSelection(currentSelectedId);
                                
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
                                {(location.notifications || (location as any).slt_enter_alarm === 'Y') ? (
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
        )}

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