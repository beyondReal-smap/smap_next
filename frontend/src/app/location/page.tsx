'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  FiSearch, 
  FiTrash2, 
  FiMapPin, 
  FiChevronDown, 
  FiX, 
  FiLoader, 
  FiBell, 
  FiBellOff,
  FiFilter,
  FiMoreVertical,
  FiArrowLeft,
  FiCheckCircle,
  FiXCircle,
  FiInfo
} from 'react-icons/fi';
import { FaSearch as FaSearchSolid } from 'react-icons/fa';
import dynamic from 'next/dynamic';

// 커스텀 알림 상태 추가 (react-toastify 관련 없음)
interface CustomToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

import { API_KEYS } from '../../config';
import ReactDOM from 'react-dom';
import memberService from '@/services/memberService';
import locationService, { OtherMemberLocationRaw } from '@/services/locationService';
import groupService, { Group } from '@/services/groupService';

// 모바일 최적화된 CSS 스타일
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
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.location-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.location-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
}

.location-card.selected {
  background: white; /* 배경색을 흰색으로 변경 */
  border-color: # ; /* 이 부분은 이전 코드에서 누락된 값으로 보입니다. 필요시 수정 */
  box-shadow: 0 8px 20px rgba(168, 85, 247, 0.25);
  transform: translateY(-1px) scale(1.01);
}

.member-avatar {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.member-avatar.selected {
  box-shadow: 0 0 0 3px #6366f1, 0 0 20px rgba(99, 102, 241, 0.4);
}

.floating-button {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5);
}

.bottom-sheet {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-top: 1px solid rgba(99, 102, 241, 0.1);
}

.search-input {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input:focus {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
}

.mobile-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.notification-badge {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.danger-badge {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.group-selector {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.group-selector:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.location-info-panel {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
}

@media (max-width: 640px) {
  .location-card {
    min-width: 240px;
  }
  
  .member-avatar {
    width: 40px; 
    height: 40px; 
  }
  
  .floating-button {
    width: 56px;
    height: 56px;
    bottom: 100px;
    right: 20px;
  }
}
`;

// Framer Motion 애니메이션 variants
const pageVariants = {
  initial: { 
    opacity: 0, 
    x: 100,
    scale: 0.95
  },
  in: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  out: { 
    opacity: 0, 
    x: -100,
    scale: 0.95,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.085, 0.68, 0.53]
    }
  }
};

const bottomSheetVariants = {
  hidden: { 
    y: '100%',
    opacity: 0
  },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 200
    }
  },
  peek: {
    y: '70%',
    opacity: 1,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 200
    }
  }
};

const memberAvatarVariants = {
  initial: { 
    scale: 0,
    opacity: 0
  },
  animate: (index: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: index * 0.1,
      type: "spring",
      stiffness: 200,
      damping: 20
    }
  }),
  hover: {
    scale: 1.1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  },
  selected: {
    scale: 1.05,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 15
    }
  }
};

const locationCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.85,
    rotateX: 15
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      type: "spring",
      stiffness: 200,
      damping: 20
    }
  }),
  hover: {
    y: -8,
    scale: 1.05,
    rotateX: -2,
    boxShadow: "0 25px 50px rgba(99, 102, 241, 0.25)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15
    }
  },
  selected: {
    scale: 1.01,
    y: -1,
    rotateX: 0,
    boxShadow: "0 15px 150px rgba(99, 102, 241, 0.3)",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1
    }
  }
};

const floatingButtonVariants = {
  initial: { 
    scale: 0,
    rotate: -180,
    y: 100
  },
  animate: { 
    scale: 1,
    rotate: 0,
    y: 0,
    transition: {
      delay: 0.8,
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  },
  hover: { 
    scale: 1.15,
    rotate: 90,
    y: -5,
    boxShadow: "0 20px 40px rgba(99, 102, 241, 0.4)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15
    }
  },
  tap: { 
    scale: 0.9,
    rotate: 45,
    transition: {
      duration: 0.1
    }
  }
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: 50,
    transition: {
      duration: 0.2
    }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const staggerItem = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20
    }
  }
};

// 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

interface NewLocationInput {
  id?: string;
  name: string;
  address: string;
  coordinates: [number, number];
  category?: string;
  memo?: string;
  favorite?: boolean;
  notifications?: boolean;
}

interface HomeLocation {
  lat: number;
  lng: number;
}

interface HomeSchedule {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: HomeLocation;
  schedules: HomeSchedule[];
  savedLocations: LocationData[];
  mt_gender?: number | null;
  original_index: number;
}

type NaverMap = any; 
type NaverCoord = any;
type NaverMarker = any;
type NaverInfoWindow = any; 
type NaverService = any; 

export default function LocationPage() {
  const router = useRouter();
  
  // 상태 관리
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isFetchingGroupMembers, setIsFetchingGroupMembers] = useState(false);
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingOtherLocations, setIsLoadingOtherLocations] = useState(false);
  
  // 지도 관련 상태
  const [map, setMap] = useState<NaverMap | null>(null);
  const [markers, setMarkers] = useState<NaverMarker[]>([]);
  const [memberMarkers, setMemberMarkers] = useState<NaverMarker[]>([]); // Add state for member markers
  const [infoWindow, setInfoWindow] = useState<NaverInfoWindow | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const tempMarker = useRef<NaverMarker | null>(null);
  
  // 그룹 및 멤버 관련 상태
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedMemberIdRef, setSelectedMemberIdRef] = useState<React.MutableRefObject<string | null>>({ current: null });
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  
  // 장소 관련 상태
  const [otherMembersSavedLocations, setOtherMembersSavedLocations] = useState<OtherMemberLocationRaw[]>([]);
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocationIdRef, setSelectedLocationIdRef] = useState<React.MutableRefObject<string | null>>({ current: null });
  
  // UI 상태
  const [bottomSheetState, setBottomSheetState] = useState<'hidden' | 'peek' | 'visible'>('visible');
  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces');
  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  
  // 검색 관련 상태
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocationForPanel, setIsSearchingLocationForPanel] = useState(false);
  const [locationSearchModalCaller, setLocationSearchModalCaller] = useState<'panel' | 'modal' | null>(null);
  
  // 새 장소 입력 상태
  const [newLocation, setNewLocation] = useState<NewLocationInput>({
    name: '',
    address: '',
    coordinates: [0, 0],
    category: '기타',
    memo: '',
    favorite: false,
    notifications: true
  });
  const [clickedCoordinates, setClickedCoordinates] = useState<[number, number] | null>(null);
  const [isSavingLocationPanel, setIsSavingLocationPanel] = useState(false);
  
  // 드래그 관련 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  
  // Refs
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // 멤버 선택 관련 상태
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);
  
  // 모달 상태 추가
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void; // 확인 콜백 추가
  } | null>(null);
  
  // 뒤로가기 핸들러
  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  // 모달 열기 함수 수정
  const openModal = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info', 
    onConfirmCallback?: () => void // 콜백 파라미터 추가
  ) => {
    setModalContent({ title, message, type, onConfirm: onConfirmCallback });
    setIsModalOpen(true);
  };

  // 모달 닫기 함수
  const closeModal = () => {
    setIsModalOpen(false);
    // 모달이 닫힐 때 onConfirm 콜백이 남아있지 않도록 초기화 (선택적)
    // setModalContent(null); // 이렇게 하면 onConfirm도 null이 됨
  };

  // 알림 토글 핸들러 (DB 업데이트 포함)
  const handleNotificationToggle = async (location: LocationData | OtherMemberLocationRaw) => {
    try {
      const locationId = 'slt_idx' in location ? location.slt_idx?.toString() : location.id;
      const sltIdx = 'slt_idx' in location ? location.slt_idx : null;
      const currentNotificationStatus = 'slt_enter_alarm' in location 
        ? location.slt_enter_alarm === 'Y' 
        : location.notifications;
      
      const newNotificationStatus = !currentNotificationStatus;
      
      console.log('[알림 토글] 시작:', locationId, 'slt_idx:', sltIdx, '→', newNotificationStatus);
      
      // DB 업데이트 (slt_idx가 있는 경우에만)
      if (sltIdx) {
        try {
          const sltIdxNumber = typeof sltIdx === 'string' ? parseInt(sltIdx, 10) : sltIdx;
          await locationService.updateLocationNotification(sltIdxNumber, newNotificationStatus);
          console.log('[알림 토글] DB 업데이트 성공:', sltIdxNumber, newNotificationStatus);
        } catch (dbError) {
          console.error('[알림 토글] DB 업데이트 실패:', dbError);
          openModal('알림 설정 실패', '알림 설정 저장에 실패했습니다.', 'error');
          return; // DB 업데이트 실패 시 UI 업데이트하지 않음
        }
      }
      
      // 1. 선택된 멤버의 장소 업데이트
      if (selectedMemberSavedLocations) {
        setSelectedMemberSavedLocations(prev => 
          prev ? prev.map(loc => 
            loc.id === locationId ? { ...loc, notifications: newNotificationStatus } : loc
          ) : null
        );
      }
      
      // 2. 다른 멤버 장소 데이터 업데이트
      if ('slt_idx' in location && location.slt_idx) {
        setOtherMembersSavedLocations(prev => prev.map(loc => 
          loc.slt_idx === location.slt_idx 
            ? { ...loc, slt_enter_alarm: newNotificationStatus ? 'Y' : 'N', notifications: newNotificationStatus } 
            : loc
        ));
      }
      
      // 3. 그룹멤버 상태 업데이트
      setGroupMembers(prevMembers => prevMembers.map(member => ({
        ...member,
        savedLocations: member.savedLocations.map(loc => 
          loc.id === locationId ? { ...loc, notifications: newNotificationStatus } : loc
        )
      })));
      
      // 4. 정보창이 열려있고 현재 선택된 장소라면 패널도 업데이트
      if (isLocationInfoPanelOpen && newLocation.id === locationId) {
        setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
      }
      
      openModal('알림 설정 완료', `알림이 ${newNotificationStatus ? '켜졌습니다' : '꺼졌습니다'}.`, 'success');
    } catch (error) {
      console.error('알림 토글 실패:', error);
      openModal('알림 설정 실패', '알림 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  // 장소 숨김 처리 핸들러 (DB 업데이트 포함)
  const handleHideLocation = async (location: LocationData | OtherMemberLocationRaw) => {
    // 이 함수는 confirm을 모달로 대체한 후 호출될 예정입니다.
    try {
      const locationId = 'slt_idx' in location ? location.slt_idx?.toString() : location.id;
      const sltIdx = 'slt_idx' in location ? location.slt_idx : null;
      const locationName = 'slt_title' in location ? location.slt_title : location.name;
      
      console.log('[장소 삭제] 시작:', locationId, 'slt_idx:', sltIdx, locationName);
      
      // DB에서 숨김 처리 (slt_idx가 있는 경우에만)
      if (sltIdx) {
        try {
          const sltIdxNumber = typeof sltIdx === 'string' ? parseInt(sltIdx, 10) : sltIdx;
          await locationService.hideLocation(sltIdxNumber); // 내부적으로는 hideLocation 호출 유지
          console.log('[장소 삭제] DB 처리 성공 (숨김 처리):', sltIdxNumber);
        } catch (dbError) {
          console.error('[장소 삭제] DB 처리 실패:', dbError);
          // 실패 시에는 onConfirm 콜백이 없는 일반 정보 모달 호출
          openModal('장소 삭제 실패', '장소 삭제 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
          return;
        }
      }
      
      // UI 업데이트 로직
      if (selectedMemberSavedLocations) {
        setSelectedMemberSavedLocations(prev => 
          prev ? prev.filter(loc => loc.id !== locationId) : null
        );
      }
      
      if ('slt_idx' in location && location.slt_idx) {
        setOtherMembersSavedLocations(prev => prev.filter(loc => loc.slt_idx !== location.slt_idx));
      }
      
      setGroupMembers(prevMembers => prevMembers.map(member => ({
        ...member,
        savedLocations: member.savedLocations.filter(loc => loc.id !== locationId)
      })));
      
      if (selectedLocationId === locationId) {
        setSelectedLocationId(null);
        selectedLocationIdRef.current = null;
      }
      
      setIsLocationInfoPanelOpen(false);
      setIsEditingPanel(false);
      if (infoWindow) {
        infoWindow.close();
        setInfoWindow(null);
      }
      
      // 성공 시에는 onConfirm 콜백이 없는 일반 정보 모달 호출
      openModal('장소 삭제 완료', `'${locationName}' 장소가 삭제되었습니다.`, 'success');
    } catch (error) {
      console.error('장소 삭제 처리 중 전체 오류:', error);
      openModal('장소 삭제 실패', '장소 삭제 처리 중 예기치 않은 오류가 발생했습니다.', 'error');
    }
  };

  // 다른 멤버 장소 조회 헬퍼
  const getOtherMemberLocationById = (id: string, locations: OtherMemberLocationRaw[]) => {
    return locations.find(loc => loc.id === id || loc.slt_idx?.toString() === id);
  };

  // 패널 주소 검색 핸들러
  const handlePanelAddressSearch = async () => {
    if (!locationSearchQuery.trim()) return;
    
      setIsSearchingLocationForPanel(true);
    setLocationSearchModalCaller('panel');
    
    try {
      // 카카오 지도 API를 사용한 주소 검색 로직
      const response = await axios.get(`https://dapi.kakao.com/v2/local/search/keyword.json`, {
        headers: {
          Authorization: `KakaoAK ${API_KEYS.KAKAO_REST_API_KEY}`
        },
        params: {
          query: locationSearchQuery,
          size: 5
        }
      });
      
      setLocationSearchResults(response.data.documents || []);
    } catch (error) {
      console.error('주소 검색 실패:', error);
      openModal('주소 검색 실패', '주소 검색 중 오류가 발생했습니다.', 'error'); // toast -> openModal
    } finally {
        setIsSearchingLocationForPanel(false);
    }
  };

  // 패널용 장소 선택 핸들러
  const handleSelectLocationForPanel = (place: any) => {
    const coordinates: [number, number] = [parseFloat(place.x), parseFloat(place.y)];
    
    setNewLocation(prev => ({
      ...prev,
      name: place.place_name || '',
      address: place.road_address_name || place.address_name || '',
      coordinates
    }));
    
    setLocationSearchResults([]);
    setLocationSearchQuery('');
    setLocationSearchModalCaller(null);
    
    // 지도에 임시 마커 표시
    if (map && window.naver) {
        if (tempMarker.current) {
            tempMarker.current.setMap(null);
        }
      
        console.log('[패널 장소 선택] 임시 마커 생성:', coordinates);
        
      const position = new window.naver.maps.LatLng(coordinates[1], coordinates[0]);
        tempMarker.current = new window.naver.maps.Marker({
        position,
        map,
        icon: {
          content: `<div style="
            width: 24px;
            height: 24px;
            background: #ef4444;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1000;
          "></div>`,
          anchor: new window.naver.maps.Point(12, 12)
        },
        zIndex: 1000
      });
      
      map.setCenter(position);
      map.setZoom(16);
    }
  };

  // 패널 액션 확인 핸들러
  const handleConfirmPanelAction = async () => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) {
      openModal('입력 오류', '장소 이름과 주소를 입력해주세요.', 'error'); // toast -> openModal
      return;
    }
    
    setIsSavingLocationPanel(true);
    
    try {
      // 실제 장소 저장 로직 구현
      await new Promise(resolve => setTimeout(resolve, 1000)); // 모의 지연
      
      openModal('장소 등록 완료', '장소가 성공적으로 등록되었습니다.', 'success'); // toast -> openModal
      setIsLocationInfoPanelOpen(false);
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
      
      // 상태 초기화
      setNewLocation({ 
        name: '', 
        address: '', 
        coordinates: [0, 0],
        category: '기타',
        memo: '',
        favorite: false,
        notifications: true
      });
    } catch (error) {
      openModal('장소 등록 실패', '장소 등록 중 오류가 발생했습니다.', 'error'); // toast -> openModal
    } finally {
      setIsSavingLocationPanel(false);
    }
  };

  // 개선된 드래그 핸들러들
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStartY(clientY);
    setDragCurrentY(clientY);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragCurrentY(clientY);
    
    const deltaY = clientY - dragStartY;
    const threshold = 80; // 임계값 감소로 더 민감하게
    
    // 부드러운 실시간 애니메이션을 위한 중간 상태 처리
    if (deltaY > threshold && bottomSheetState === 'visible') {
      setBottomSheetState('peek');
    } else if (deltaY < -threshold && bottomSheetState === 'peek') {
      setBottomSheetState('visible');
    }
  };

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const deltaY = dragCurrentY - dragStartY;
    const threshold = 40; // 더 민감한 임계값
    const velocity = Math.abs(deltaY) / 100; // 속도 계산
    
    // 햅틱 피드백 추가 (모바일에서)
    const triggerHaptic = () => {
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
    };
    
    if (Math.abs(deltaY) > threshold || velocity > 0.3) {
      if (deltaY > 0) {
        setBottomSheetState('peek');
        triggerHaptic();
      } else {
        setBottomSheetState('visible');
        triggerHaptic();
      }
    }
  };

  // 그룹 선택 핸들러
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId);
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    setBottomSheetState('peek');
    
    // *** 기존 마커 및 데이터 초기화 강화 ***
    // 1. 현재 지도에 있는 모든 멤버 마커 즉시 제거
    if (map && memberMarkers.length > 0) {
      console.log('[handleGroupSelect] 기존 멤버 마커 즉시 제거 시작:', memberMarkers.length, '개');
      memberMarkers.forEach(marker => {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(null);
        }
      });
      console.log('[handleGroupSelect] 기존 멤버 마커 지도에서 제거 완료');
    }
    setMemberMarkers([]); // 상태 배열도 확실히 비움

    // 2. 다른 멤버/장소 관련 상태 초기화
    setGroupMembers([]);
    setSelectedMemberSavedLocations(null);
    setOtherMembersSavedLocations([]);
    setFirstMemberSelected(false);
    setIsFirstMemberSelectionComplete(false);
    selectedMemberIdRef.current = null; // 선택된 멤버 ID도 초기화
    
    // 선택된 장소 관련 상태도 초기화
    setSelectedLocationId(null);
    selectedLocationIdRef.current = null;
    if (infoWindow) { // 열려있는 정보창이 있다면 닫기
      infoWindow.close();
      setInfoWindow(null);
    }
    markers.forEach(marker => marker.setMap(null)); // 장소 마커도 제거
    setMarkers([]);
    
    console.log('[handleGroupSelect] 기존 데이터 초기화 완료, 새 그룹 데이터 로딩 시작');
    // fetchGroupMembersData()는 selectedGroupId useEffect에 의해 호출될 것임
  };

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
            photo: member.mt_file1 ? (member.mt_file1.startsWith('http') ? member.mt_file1 : `http://118.67.130.71:8000/storage/${member.mt_file1}`) : null, // Changed https to http
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
        
        // 첫 번째 멤버 자동 선택
        if (convertedMembers.length > 0 && !isFirstMemberSelectionComplete) {
          console.log('[fetchGroupMembersData] 첫 번째 멤버 자동 선택:', convertedMembers[0].name);
          // 약간의 지연을 두어 상태 업데이트가 완료된 후 실행
          setTimeout(() => {
            handleMemberSelect(convertedMembers[0].id);
            setIsFirstMemberSelectionComplete(true);
          }, 100);
        }
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

  // 멤버 선택 핸들러
  const handleMemberSelect = async (memberId: string, openLocationPanel = false) => { 
    console.log('[handleMemberSelect] 멤버 선택:', memberId, '패널 열기:', openLocationPanel);
    
    const newlySelectedMember = groupMembers.find(member => member.id === memberId);

    if (!newlySelectedMember) {
       console.log('[handleMemberSelect] 멤버를 찾을 수 없습니다:', memberId);
       return;
    }

    // 이미 선택된 멤버이고, 첫 멤버 선택이 완료된 상태라면 중복 실행 방지
    if (selectedMemberIdRef.current === memberId && isFirstMemberSelectionComplete) {
       console.log('[handleMemberSelect] 이미 선택된 멤버입니다. 중복 실행 방지:', memberId);
       return;
    }

    // *** 마커 정리 로직 강화 ***
    // 1. 현재 지도에 있는 모든 멤버 마커 즉시 제거
    if (map && memberMarkers.length > 0) {
      console.log('[handleMemberSelect] 기존 멤버 마커 제거 시작:', memberMarkers.length, '개');
      memberMarkers.forEach(marker => {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(null);
        }
      });
      console.log('[handleMemberSelect] 기존 멤버 마커 지도에서 제거 완료');
    }
    // 2. 마커 상태 배열 비우기 (setMemberMarkers는 updateMemberMarkers 함수 내에서 처리되도록 변경 가능성 검토)
    // setMemberMarkers([]); // 일단 여기서 상태를 비우는 것보다, updateMemberMarkers가 책임지도록 할 수 있음

        // 선택된 장소 관련 상태 초기화
    setSelectedLocationId(null);
    selectedLocationIdRef.current = null;
    setSelectedMemberSavedLocations(null);
    
    // 기존 장소 마커들 제거
    if (markers.length > 0) {
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
    }
    
    selectedMemberIdRef.current = memberId;
  
    const updatedMembers = groupMembers.map(member => ({
        ...member,
        isSelected: member.id === memberId
    }));
    setGroupMembers(updatedMembers); // 이 호출이 updateMemberMarkers를 트리거 (useEffect를 통해)
  
    if (map && window.naver?.maps) {
      // 선택된 멤버의 위치로 지도 중심 이동
      console.log('[handleMemberSelect] 멤버 선택:', newlySelectedMember.name, '위치:', newlySelectedMember.location);
      const memberPosition = new window.naver.maps.LatLng(newlySelectedMember.location.lat, newlySelectedMember.location.lng);
      map.setCenter(memberPosition);
      map.setZoom(16); // 적절한 줌 레벨로 설정
      
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
          
        } catch (error) {
          console.error("Failed to fetch selected member's locations in handleMemberSelect:", error);
          setSelectedMemberSavedLocations([]);
          setOtherMembersSavedLocations([]);
          setActiveView('selectedMemberPlaces');
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
      setIsLocationInfoPanelOpen(false); 
      setIsEditingPanel(false);
      
      // 첫번째 멤버 선택 완료 상태 설정 (실패한 경우에도)
      if (!isFirstMemberSelectionComplete) {
        setIsFirstMemberSelectionComplete(true);
        console.log('[handleMemberSelect] 첫번째 멤버 선택 완료 (실패)');
      }
    }
  };

  // 뷰 변경 핸들러
  const handleViewChange = (view: 'selectedMemberPlaces' | 'otherMembersPlaces') => {
    setActiveView(view);
    if (swipeContainerRef.current) {
      const scrollLeft = view === 'selectedMemberPlaces' ? 0 : swipeContainerRef.current.scrollWidth / 2;
      swipeContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  };

  // 모달 렌더러
  const renderModal = (content: React.ReactNode) => {
    return ReactDOM.createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => setIsAddModalOpen(false)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </motion.div>,
      document.body
    );
  };

  // 네이버 지도 로드
  useEffect(() => {
    const loadNaverMaps = () => {
      if (window.naver && window.naver.maps) {
        setIsMapLoading(false);
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${API_KEYS.NAVER_MAPS_CLIENT_ID}&submodules=geocoder`;
      script.async = true;
      script.onload = () => {
        setIsMapLoading(false);
      };
      script.onerror = () => {
        console.error('네이버 지도 로드 실패');
        setIsMapLoading(false);
      };
      document.head.appendChild(script);
    };

    loadNaverMaps();
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isMapLoading && mapContainer.current && window.naver && !map) {
      const mapOptions = {
        center: new window.naver.maps.LatLng(37.5665, 126.9780),
        zoom: 13,
        minZoom: 8,
        maxZoom: 18,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
          style: window.naver.maps.ZoomControlStyle.SMALL
        }
      };

      const newMap = new window.naver.maps.Map(mapContainer.current, mapOptions);
      setMap(newMap);
      setIsMapInitialized(true);

      // 지도 클릭 이벤트
      window.naver.maps.Event.addListener(newMap, 'click', (e: any) => {
        const coord = e.coord;
        const coordinates: [number, number] = [coord.lng(), coord.lat()];
        
        setClickedCoordinates(coordinates);
        setNewLocation(prev => ({
          ...prev,
          coordinates,
          address: '주소 변환 중...'
        }));
        
        // 임시 마커 표시
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
        
        console.log('[지도 클릭] 임시 마커 생성 시작:', coord.lat(), coord.lng());
        
        tempMarker.current = new window.naver.maps.Marker({
          position: coord,
          map: newMap,
          icon: {
            content: `<div style="
              width: 24px;
              height: 24px;
              background: #ef4444;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              position: relative;
              z-index: 1000;
            "></div>`,
            anchor: new window.naver.maps.Point(12, 12)
          },
          zIndex: 1000
        });
        
        console.log('[지도 클릭] 임시 마커 생성 완료:', tempMarker.current);
        
        // 지도 중심을 클릭한 위치로 이동
        newMap.setCenter(coord);
        newMap.setZoom(16);
        
        // 바텀시트를 peek 상태로 변경
        setBottomSheetState('peek');
        
        setIsLocationInfoPanelOpen(true);
        setIsEditingPanel(false);
        
        // 주소 변환
        if (window.naver.maps.Service) {
          window.naver.maps.Service.reverseGeocode({
            coords: coord,
            orders: [
              window.naver.maps.Service.OrderType.ADDR,
              window.naver.maps.Service.OrderType.ROAD_ADDR
            ].join(',')
          }, (status: any, response: any) => {
            if (status === window.naver.maps.Service.Status.OK) {
              const result = response.v2;
              const address = result.address;
              const roadAddress = result.roadAddress;
              
              const finalAddress = roadAddress ? roadAddress.jibunAddress : address.jibunAddress;
              
              setNewLocation(prev => ({
                ...prev,
                address: finalAddress || '주소를 찾을 수 없습니다.'
              }));
            }
          });
        }
      });
    }
  }, [isMapLoading, map]);

  // 그룹 데이터 로드
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

  // 페이지 로드 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // 지도 정보창에서 호출할 글로벌 함수 설정
  useEffect(() => {
    // 알림 토글 함수를 window 객체에 등록
    (window as any).handleNotificationToggleFromMap = (locationId: string) => {
      const location = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
                      otherMembersSavedLocations.find(loc => loc.slt_idx?.toString() === locationId);
      if (location) {
        handleNotificationToggle(location);
      }
    };

    // 장소 숨김 함수를 window 객체에 등록
    (window as any).handleHideLocationFromMap = (locationId: string) => {
      const location = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
                      otherMembersSavedLocations.find(loc => loc.slt_idx?.toString() === locationId);
      if (location) {
        handleHideLocation(location); // 여기서는 handleHideLocation 호출
      }
    };

    // 장소 숨김(삭제) 함수를 window 객체에 등록 (이제 모달을 띄우는 역할)
    (window as any).handleDeleteLocationFromMap = (locationId: string, locationName: string) => {
      const locationObject = selectedMemberSavedLocations?.find(loc => loc.id === locationId) ||
                            otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === locationId);
      if (locationObject) {
        openModal(
          `'${locationName}' 삭제 확인`,
          '정말로 이 장소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
          'info',
          () => handleHideLocation(locationObject) // 실제 삭제는 handleHideLocation이 담당
        );
      }
    };

    // 컴포넌트 언마운트 시 정리
    return () => {
      delete (window as any).handleNotificationToggleFromMap;
      delete (window as any).handleDeleteLocationFromMap;
    };
  }, [selectedMemberSavedLocations, otherMembersSavedLocations, handleNotificationToggle, handleHideLocation, openModal]); // openModal 의존성 추가

  // 다른 멤버 장소 로드
  useEffect(() => {
    const loadOtherMemberLocations = async () => {
    const currentSelectedMember = groupMembers.find(m => m.isSelected);
      if (activeView === 'otherMembersPlaces' && currentSelectedMember?.id) {
        setIsLoadingOtherLocations(true);
        try {
          const fetchedLocationsRaw = await locationService.getOtherMembersLocations(currentSelectedMember.id);
          console.log("[useEffect/activeView] Other members' locations (raw):", fetchedLocationsRaw);
          setOtherMembersSavedLocations(fetchedLocationsRaw);
        } catch (error) {
          console.error("Failed to fetch other members' locations on view change", error);
          setOtherMembersSavedLocations([]);
        } finally {
          setIsLoadingOtherLocations(false);
        }
      } else if (activeView === 'selectedMemberPlaces' && currentSelectedMember) {
        // selectedMemberPlaces 뷰에서는 이미 로드된 데이터 사용
      } else if (!currentSelectedMember) {
        // 선택된 멤버가 없으면 빈 배열
        setOtherMembersSavedLocations([]);
      }
    };

    if (isMapInitialized) { 
      loadOtherMemberLocations();
    }
  }, [isMapInitialized, activeView, selectedMemberIdRef.current]);

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

  // 좌표 안전성 검사 헬퍼 함수
  const parseCoordinate = (coord: any): number | null => {
    if (typeof coord === 'number') return coord;
    if (typeof coord === 'string' && !isNaN(parseFloat(coord))) return parseFloat(coord);
    return null;
  };

  // 안전한 이미지 URL 가져오기 헬퍼 함수
  const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
    // URL이 안전하지 않거나 null인 경우, 또는 백엔드 서버 이미지인 경우 기본 이미지 사용
    if (!photoUrl || photoUrl.includes('118.67.130.71:8000') || photoUrl.includes('http://118.67.130.71:8000')) {
      return getDefaultImage(gender, index);
    }
    return photoUrl;
  };

  // 지도에 그룹멤버 마커 표시 (home/page.tsx 방식 참고)
  const updateMemberMarkers = (members: GroupMember[]) => {
    if (!map || !window.naver) {
      console.log('[updateMemberMarkers] 지도 또는 네이버 API가 준비되지 않음');
      return;
    }

    console.log('[updateMemberMarkers] 시작 - 기존 마커:', memberMarkers.length, '개, 새 멤버:', members.length, '명');

    // 기존 멤버 마커들 제거
    memberMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    setMemberMarkers([]);

    // 새 멤버 마커들 생성
    const newMemberMarkers: NaverMarker[] = [];
    
    // 모든 그룹멤버에 대해 마커 생성 (home/page.tsx 방식)
    if (members.length > 0) {
      members.forEach((member, index) => {
        // 좌표 안전성 검사
        const lat = parseCoordinate(member.location.lat);
        const lng = parseCoordinate(member.location.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
          const position = new window.naver.maps.LatLng(lat, lng);
          // 선택된 멤버는 핑크색 외곽선, 일반 멤버는 인디고 외곽선 (home/page.tsx 스타일)
          const borderColor = member.isSelected ? '#EC4899' : '#4F46E5';
          
          const marker = new window.naver.maps.Marker({
            position: position,
            map: map,
            title: member.name,
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

          // 멤버 마커 클릭 이벤트
          window.naver.maps.Event.addListener(marker, 'click', () => {
            handleMemberSelect(member.id);
            
            // 기존 정보창 닫기
            if (infoWindow) {
              infoWindow.close();
            }

            // 멤버 정보창 생성
            const memberInfoWindow = new window.naver.maps.InfoWindow({
              content: `
                <div style="
                  padding: 16px;
                  min-width: 200px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: white;
                  border-radius: 12px;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                ">
                  <div style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                  ">
                    <div style="
                      width: 40px;
                      height: 40px;
                      border-radius: 50%;
                      overflow: hidden;
                      margin-right: 12px;
                      border: 2px solid ${borderColor};
                    ">
                      <img src="${photoForMarker}" 
                           style="width: 100%; height: 100%; object-fit: cover;" 
                           alt="${member.name}" />
                    </div>
                    <div>
                      <h3 style="
                        margin: 0;
                        font-size: 16px;
                        font-weight: 600;
                        color: #1f2937;
                      ">${member.name}</h3>
                      <p style="
                        margin: 4px 0 0 0;
                        font-size: 12px;
                        color: #6b7280;
                      ">${member.isSelected ? '선택된 멤버' : '그룹 멤버'}</p>
                    </div>
                  </div>
                  
                  <div style="
                    background: #f3f4f6;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #374151;
                  ">
                    📍 현재 위치: ${lat.toFixed(4)}, ${lng.toFixed(4)}
                  </div>
                </div>
              `,
              borderWidth: 0,
              backgroundColor: 'transparent',
              pixelOffset: new window.naver.maps.Point(0, -15)
            });

            memberInfoWindow.open(map, marker);
            setInfoWindow(memberInfoWindow);
          });

          newMemberMarkers.push(marker);
        } else {
          console.warn('유효하지 않은 멤버 좌표:', member.name, member.location);
        }
      });

      // 선택된 멤버가 있으면 해당 위치로 지도 이동 (home/page.tsx 방식)
      const selectedMember = members.find(member => member.isSelected);
      if (selectedMember) {
        const lat = parseCoordinate(selectedMember.location.lat);
        const lng = parseCoordinate(selectedMember.location.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          // 지도 중심 이동 및 줌 레벨 조정
          setTimeout(() => {
            map.setCenter(new window.naver.maps.LatLng(lat, lng));
            map.setZoom(16);
            console.log('지도 중심 이동:', selectedMember.name, { lat, lng });
          }, 100);
        } else {
          console.warn('유효하지 않은 선택된 멤버 좌표:', selectedMember.name, selectedMember.location);
        }
      }
    }

    setMemberMarkers(newMemberMarkers);
    console.log('[updateMemberMarkers] 멤버 마커 업데이트 완료:', newMemberMarkers.length, '개');
  };

  // 지도에 장소 마커 표시
  const updateMapMarkers = (locations: LocationData[]) => {
    if (!map || !window.naver) return;

    // 기존 마커들 제거
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    // 새 마커들 생성
    const newMarkers: NaverMarker[] = [];
    
    locations.forEach((location, index) => {
      const [lng, lat] = location.coordinates;
      
      // 유효한 좌표인지 확인
      if (lat === 0 && lng === 0) return;
      
      const position = new window.naver.maps.LatLng(lat, lng);
      
      // 개선된 애니메이션 마커 생성
      // 선택 상태 확인 - 현재 선택된 장소 ID와 정확히 일치하는지 확인
      const isMarkerSelected = selectedLocationIdRef.current === location.id;
      
      const marker = new window.naver.maps.Marker({
        position,
        map,
        title: location.name,
        icon: {
          content: `
            <div style="position: relative; text-align: center;">
              <div style="
                width: 32px;
                height: 32px;
                background-color: white;
                border: 2px solid ${isMarkerSelected ? '#ec4899' : '#6366f1'};
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                position: relative;
                z-index: ${isMarkerSelected ? '200' : '150'};
                transition: all 0.3s ease;
              ">
                <svg width="16" height="16" fill="${isMarkerSelected ? '#ec4899' : '#6366f1'}" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                </svg>
              </div>
              
              ${isMarkerSelected ? `
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 40px;
                  height: 40px;
                  background: rgba(236, 72, 153, 0.2);
                  border-radius: 50%;
                  animation: selectedGlow 2s ease-in-out infinite;
                  z-index: 140;
                "></div>
              ` : ''}
              
              <div style="
                position: absolute;
                bottom: -18px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0,0,0,0.7);
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
                white-space: nowrap;
                font-size: 10px;
                font-weight: 500;
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
              ">
                ${location.name}
              </div>
            </div>
            
            <style>
              @keyframes selectedGlow {
                0%, 100% { 
                  transform: translate(-50%, -50%) scale(0.8); 
                  opacity: 0.4; 
                }
                50% { 
                  transform: translate(-50%, -50%) scale(1.2); 
                  opacity: 0.1; 
                }
              }
            </style>
          `,
          anchor: new window.naver.maps.Point(16, 16)
        },
        zIndex: isMarkerSelected ? 200 : 150
      });

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, 'click', () => {
        // 기존 정보창 닫기
        if (infoWindow) {
          infoWindow.close();
        }

        // 통일된 정보창 생성
        const newInfoWindow = createLocationInfoWindow(location.name, location.address);
        newInfoWindow.open(map, marker);
        setInfoWindow(newInfoWindow);

        // 선택 상태 업데이트 (마커 재생성 없이)
        const previousSelectedId = selectedLocationIdRef.current;
        setSelectedLocationId(location.id);
        selectedLocationIdRef.current = location.id;
        
        console.log('[마커 클릭] 장소 선택됨:', location.id, location.name, '이전 선택:', previousSelectedId);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    console.log('[updateMapMarkers] 마커 업데이트 완료:', newMarkers.length, '개');
  };

  // 선택된 멤버의 장소가 변경될 때 마커 업데이트
  useEffect(() => {
    if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0) {
      console.log('[useEffect] 선택된 멤버 장소 마커 업데이트:', selectedMemberSavedLocations.length, '개');
      updateMapMarkers(selectedMemberSavedLocations);
          } else {
      // 장소가 없으면 기존 마커들 제거
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
      if (infoWindow) {
        infoWindow.close();
        setInfoWindow(null);
      }
    }
  }, [selectedMemberSavedLocations, map]);

  // 선택된 장소가 변경될 때만 마커 스타일 업데이트 (무한 루프 방지)
  useEffect(() => {
    if (selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0 && markers.length > 0) {
      console.log('[useEffect] 선택된 장소 변경으로 마커 스타일 업데이트:', selectedLocationIdRef.current);
      
      // 기존 마커들의 스타일만 업데이트 (재생성 없이)
      markers.forEach((marker, index) => {
        const location = selectedMemberSavedLocations[index];
        if (location) {
          const isSelected = selectedLocationIdRef.current === location.id;
          
          // 마커 아이콘 업데이트
          marker.setIcon({
            content: `
              <div style="position: relative; text-align: center;">
                <div style="
                  width: 32px;
                  height: 32px;
                  background-color: white;
                  border: 2px solid ${isSelected ? '#ec4899' : '#6366f1'};
                  border-radius: 50%;
                  overflow: hidden;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  position: relative;
                  z-index: ${isSelected ? '200' : '150'};
                  transition: all 0.3s ease;
                ">
                  <svg width="16" height="16" fill="${isSelected ? '#ec4899' : '#6366f1'}" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                  </svg>
                </div>
                
                ${isSelected ? `
                  <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 40px;
                    height: 40px;
                    background: rgba(236, 72, 153, 0.2);
                    border-radius: 50%;
                    animation: selectedGlow 2s ease-in-out infinite;
                    z-index: 140;
                  "></div>
                ` : ''}
                
                <div style="
                  position: absolute;
                  bottom: -18px;
                  left: 50%;
                  transform: translateX(-50%);
                  background-color: rgba(0,0,0,0.7);
                  color: white;
                  padding: 2px 5px;
                  border-radius: 3px;
                  white-space: nowrap;
                  font-size: 10px;
                  font-weight: 500;
                  max-width: 80px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                ">
                  ${location.name}
                </div>
              </div>
              
              <style>
                @keyframes selectedGlow {
                  0%, 100% { 
                    transform: translate(-50%, -50%) scale(0.8); 
                    opacity: 0.4; 
                  }
                  50% { 
                    transform: translate(-50%, -50%) scale(1.2); 
                    opacity: 0.1; 
                  }
                }
              </style>
            `,
            anchor: new window.naver.maps.Point(16, 16)
          });
          
          // z-index 업데이트
          marker.setZIndex(isSelected ? 200 : 150);
        }
      });
    }
  }, [selectedLocationId]); // selectedLocationId가 변경될 때만 실행

  // 그룹멤버가 변경되거나 멤버 선택이 변경될 때 멤버 마커 업데이트 (중복 실행 방지)
  useEffect(() => {
    if (groupMembers.length > 0 && map && window.naver) {
      console.log('[useEffect] 멤버 마커 업데이트:', groupMembers.length, '명', '선택된 멤버:', selectedMemberIdRef.current);
      updateMemberMarkers(groupMembers);
    }
  }, [groupMembers, selectedMemberIdRef.current, map]);

  // 통일된 정보창 생성 함수
  const createLocationInfoWindow = (locationName: string, locationAddress: string) => {
    return new window.naver.maps.InfoWindow({
      content: `
        <div style="
          padding: 8px 12px;
          min-width: 160px;
          max-width: 200px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.1);
        ">
          <div style="
            margin-bottom: 6px;
          ">
            <h3 style="margin: 0; font-size: 13px; font-weight: 600; color: #111827; line-height: 1.2;">${locationName}</h3>
          </div>
          
          <div>
            <p style="margin: 0; font-size: 11px; color: #4b5563; line-height: 1.3; background: #f3f4f6; padding: 4px 6px; border-radius: 4px; border-left: 2px solid #3b82f6; word-break: keep-all;">${locationAddress}</p>
          </div>
        </div>
      `,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true,
      pixelOffset: new window.naver.maps.Point(100, -5)
    });
  };

  // 장소 카드 클릭 핸들러
  const handleLocationCardClick = (location: OtherMemberLocationRaw) => {
    const lat = parseFloat(String(location.slt_lat || '0')) || 0;
    const lng = parseFloat(String(location.slt_long || '0')) || 0;
    
    // 선택된 장소 ID 설정 - 좌표와 관계없이 항상 설정
    const locationId = location.slt_idx ? location.slt_idx.toString() : location.id;
    const previousSelectedId = selectedLocationIdRef.current;
    
    // 상태 업데이트
    setSelectedLocationId(locationId);
    selectedLocationIdRef.current = locationId;
    
    console.log('[handleLocationCardClick] 장소 선택됨:', locationId, location.name || location.slt_title, '이전 선택:', previousSelectedId);
    
    // 지도와 좌표가 유효한 경우에만 지도 이동 및 마커 처리
    if (!map || !window.naver || lat === 0 || lng === 0) {
      console.log('[handleLocationCardClick] 지도 이동 불가 - 좌표 없음 또는 지도 미초기화');
      return;
    }
    
    const position = new window.naver.maps.LatLng(lat, lng);
    
    // 지도 중심을 해당 위치로 이동
    map.setCenter(position);
    map.setZoom(16);
    
    // 해당 마커 클릭 시뮬레이션 (정보창 표시)
    const markerIndex = otherMembersSavedLocations.findIndex(loc => 
      (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === locationId
    );
    
    if (markerIndex !== -1 && markers[markerIndex]) {
      // 기존 정보창 닫기
      if (infoWindow) {
        infoWindow.close();
      }
      
      // 통일된 정보창 생성 및 표시
      const locationName = location.name || location.slt_title || '제목 없음';
      const locationAddress = location.address || location.slt_add || '주소 정보 없음';
      
      const newInfoWindow = createLocationInfoWindow(locationName, locationAddress);
      newInfoWindow.open(map, markers[markerIndex]);
      setInfoWindow(newInfoWindow);
    }
    
    console.log('[handleLocationCardClick] 장소 카드 클릭:', location.name || location.slt_title || '제목 없음', '위치:', lat, lng);
  };

  useEffect(() => {
    // 페이지 로드 시 첫 번째 멤버 자동 선택
    if (groupMembers.length > 0 && !selectedMemberIdRef.current) {
      handleMemberSelect(groupMembers[0].id);
    }
  }, [groupMembers, selectedMemberIdRef.current, handleMemberSelect]);

  return (
    <>
      <style jsx global>{mobileStyles}</style>
      
      <motion.div
        initial="initial"
        animate={
          isExiting ? "out" : "in"
        }
        variants={pageVariants}
        className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen relative overflow-hidden"
      >
        {/* 개선된 헤더 */}
        <motion.header 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="sticky top-0 z-20 glass-effect"
        >
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              {/* 뒤로가기 버튼 제거 */}
              {/* <motion.button 
                whileHover={{ scale: 1.05, rotate: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBack}
                disabled={isExiting}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200 mobile-button disabled:opacity-50"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-700" />
              </motion.button> */}
              
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="p-2 bg-indigo-600 rounded-xl"
                >
                  <FiMapPin className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">내 장소</h1>
                  <p className="text-xs text-gray-500">그룹 멤버들과 장소를 공유해보세요</p>
              </div>
            </div>
          </div>
            
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200 mobile-button"
                onClick={() => {
                  setIsLocationInfoPanelOpen(true);
                  setIsEditingPanel(false);
                  // 새 장소 입력을 위한 기본값 설정
                  setNewLocation({
                    name: '',
                    address: '',
                    coordinates: [0, 0],
                    category: '기타',
                    memo: '',
                    favorite: false,
                    notifications: true
                  });
                }}
              >
                <FiSearch className="w-5 h-5 text-gray-600" />
              </motion.button>
              
              {/* 필터 버튼 제거 */}
              {/* <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200 mobile-button"
              >
                <FiFilter className="w-5 h-5 text-gray-600" />
              </motion.button> */}
              
              {/* 점 세개 버튼 제거 */}
              {/* <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200 mobile-button"
              >
                <FiMoreVertical className="w-5 h-5 text-gray-600" />
              </motion.button> */}
        </div>
          </div>
        </motion.header>

        {/* 전체화면 로딩 */}
        <AnimatePresence>
        {(isMapLoading || isFetchingGroupMembers || !isFirstMemberSelectionComplete) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center"
            >
              <motion.div 
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="text-center"
              >
                <motion.div
                  variants={staggerItem}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <FiMapPin className="w-full h-full text-white" />
                </motion.div>
                
                <motion.div variants={staggerItem}>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {isMapLoading 
                      ? "지도를 불러오는 중입니다" 
                : isFetchingGroupMembers 
                        ? "데이터를 불러오는 중입니다"
                        : "첫번째 멤버 위치로 이동 중입니다"
                    }
                  </h3>
                  <p className="text-gray-600">잠시만 기다려주세요...</p>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 지도 컨테이너 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="map-container fixed top-16 left-0 right-0 bottom-0 w-full"
        >
          <div 
            ref={mapContainer} 
            className="w-full h-full"
          />
        </motion.div>

        {/* 개선된 위치 정보 패널 */}
        <AnimatePresence>
        {isLocationInfoPanelOpen && (
            <motion.div 
            ref={infoPanelRef} 
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="location-info-panel fixed top-20 left-4 right-4 z-30 rounded-2xl p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
              <div className="flex justify-between items-center mb-1 pb-1">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h3 className="text-lg font-bold text-gray-800">
                {isEditingPanel ? "장소 정보" : 
                      (groupMembers.find(m => m.isSelected)?.name ? 
                        `${groupMembers.find(m => m.isSelected)?.name}의 새 장소 등록` : 
                        "새 장소 등록")
                } 
              </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEditingPanel ? "장소 정보를 확인하고 관리하세요" : "지도를 클릭하거나 검색하세요"}
                  </p>
                </motion.div>
                
                <div className="flex items-center space-x-2">
                {isEditingPanel && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      const newNotificationStatus = !newLocation.notifications;
                      
                      // 정보창 패널의 알림 상태 즉시 업데이트
                      setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
                      
                      // 편집 모드에서만 실제 데이터 업데이트
                      if (isEditingPanel && newLocation.id) {
                        const locationData = selectedMemberSavedLocations?.find(loc => loc.id === newLocation.id) ||
                                           otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === newLocation.id);
                        
                        if (locationData) {
                          handleNotificationToggle(locationData);
                        }
                      }
                      }}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        newLocation.notifications 
                          ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200'
                    }`}
                    aria-label={newLocation.notifications ? '알림 끄기' : '알림 켜기'}
                  >
                      {newLocation.notifications ? <FiBell size={16} /> : <FiBellOff size={16} />}
                    </motion.button>
                  )}
                  
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                  setIsLocationInfoPanelOpen(false);
                  if (tempMarker.current) tempMarker.current.setMap(null);
                  setIsEditingPanel(false);
                    }} 
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  > 
                  <FiX size={20}/>
                  </motion.button>
              </div>
            </div>

            {isEditingPanel ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                <div className="mb-4"> 
                  <p className="text-base font-semibold text-gray-800 truncate">{newLocation.name}</p>
                  <p className="text-sm text-gray-600 mt-1 break-words">{newLocation.address || '주소 정보 없음'}</p>
                </div>
                
                {/* 편집 모드 액션 버튼들 */}
                <motion.div className="flex space-x-3 mt-6"> 
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      // 삭제 확인 모달을 먼저 띄웁니다.
                      const locationToProcess = selectedMemberSavedLocations?.find(loc => loc.id === newLocation.id) ||
                                         otherMembersSavedLocations.find(loc => (loc.slt_idx ? loc.slt_idx.toString() : loc.id) === newLocation.id);
                      if (locationToProcess) {
                        openModal(
                          `'${newLocation.name}' 삭제 확인`,
                          '정말로 이 장소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                          'info', // type을 'info' 또는 'warning' 등으로 하여 확인 모달임을 표시
                          () => handleHideLocation(locationToProcess) // 확인 시 실행할 콜백
                        );
                      }
                    }}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl shadow-lg mobile-button"
                  >
                    <div className="flex items-center justify-center">
                      <FiTrash2 className="mr-2" size={16} />
                      삭제
                    </div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsLocationInfoPanelOpen(false);
                      if (tempMarker.current) tempMarker.current.setMap(null);
                      setIsEditingPanel(false);
                    }}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-xl shadow-lg mobile-button"
                  >
                    닫기
                  </motion.button>
                </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="지번, 도로명, 건물명으로 검색"
                      className="search-input w-full py-3 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePanelAddressSearch();
                      }
                    }}
                  />
                  {isSearchingLocationForPanel ? (
                      <FiLoader className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 animate-spin" />
                  ) : (
                      <FaSearchSolid className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer" onClick={handlePanelAddressSearch} />
                  )}
                </div>

                  {/* 검색 결과 */}
                  <AnimatePresence>
                {locationSearchModalCaller === 'panel' && locationSearchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4"
                      >
                        <p className="text-xs font-medium text-indigo-600 mb-2 px-1">검색 결과</p>
                        <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100"> 
                      <ul className="divide-y divide-gray-200"> 
                            {locationSearchResults.map((place, index) => (
                              <motion.li 
                                key={place.temp_id || place.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="p-3 cursor-pointer hover:bg-gray-100 transition-colors duration-200" 
                                onClick={() => handleSelectLocationForPanel(place)}
                              > 
                                <p className="font-semibold text-gray-800 truncate text-xs">{place.place_name}</p> 
                                <p className="text-gray-600 truncate text-xs">{place.road_address_name || place.address_name}</p> 
                              </motion.li>
                        ))}
                      </ul>
                    </div>
                      </motion.div>
                )}
                  </AnimatePresence>

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

                <div className="mb-4 mt-4"> 
                    <label htmlFor="panelLocationName" className="block text-xs font-medium text-indigo-600 mb-2">장소 태그 (이름)</label>
                  <input
                    type="text"
                    id="panelLocationName"
                      className="search-input w-full py-3 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="이 장소에 대한 나만의 이름을 지어주세요."
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                  {/* 액션 버튼들 */}
                  <motion.div className="flex space-x-3"> 
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                    setIsLocationInfoPanelOpen(false);
                    if (tempMarker.current) tempMarker.current.setMap(null);
                    setIsEditingPanel(false);
                      }}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-xl shadow-lg mobile-button"
                    >
                      닫기
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleConfirmPanelAction}
                      disabled={isSavingLocationPanel}
                      className="flex-1 py-3 px-4 bg-indigo-700 text-white font-medium rounded-xl shadow-lg mobile-button disabled:opacity-50"
                    >
                      {isSavingLocationPanel ? (
                        <div className="flex items-center justify-center">
                          <FiLoader className="animate-spin mr-2" />
                          저장 중...
                </div>
                      ) : (
                        "내 장소 등록"
            )}
                    </motion.button>
                  </motion.div>
                </motion.div>
        )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 개선된 바텀시트 */}
        {!(isMapLoading || isFetchingGroupMembers || !isFirstMemberSelectionComplete) && (
          <motion.div
          ref={bottomSheetRef}
            variants={bottomSheetVariants}
            animate={bottomSheetState}
            className="bottom-sheet fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl shadow-2xl max-h-[50vh] overflow-hidden"
            style={{ touchAction: 'pan-x' }}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
            {/* 바텀시트 핸들 */}
            <motion.div 
              className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-4 mb-6"
              whileHover={{ scale: 1.2, backgroundColor: '#6366f1' }}
              transition={{ duration: 0.2 }}
            />
            
            <div className="px-6 pb-2 overflow-y-auto max-h-full">
            <div
              ref={swipeContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
            >
                {/* 그룹 멤버 섹션 */}
              <div className="w-full flex-shrink-0 snap-start">
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100 h-[200px] overflow-y-auto hide-scrollbar"
                  >
                    <div className="flex justify-between items-center mb-2">
                       <div className="flex items-center space-x-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">그룹 멤버</h2>
                          <p className="text-sm text-gray-600">멤버들의 장소를 확인하세요</p>
                        </div>
                        {isFetchingGroupMembers && (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <FiLoader className="text-indigo-500" size={18}/>
                          </motion.div>
                        )}
                       </div>
                       
                      <div className="flex items-center space-x-3">
                         {/* 그룹 선택 드롭다운 */}
                         <div className="relative">
                          <motion.button
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                             onClick={() => setIsGroupSelectorOpen(!isGroupSelectorOpen)}
                            className="group-selector flex items-center justify-between px-4 py-2 rounded-xl text-sm font-medium min-w-[140px] mobile-button"
                             disabled={isLoadingGroups}
                             data-group-selector="true"
                           >
                             <span className="truncate text-gray-700">
                               {isLoadingGroups 
                                 ? '로딩 중...' 
                                 : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                               }
                             </span>
                            <div className="ml-2 flex-shrink-0">
                               {isLoadingGroups ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <FiLoader className="text-gray-400" size={14} />
                                </motion.div>
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
                                className="absolute top-full right-0 z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[180px]"
                              >
                                <motion.div
                                  variants={staggerContainer}
                                  initial="hidden"
                                  animate="visible"
                                >
                                  {userGroups.map((group, index) => (
                                    <motion.button
                                   key={group.sgt_idx}
                                      variants={staggerItem}
                                   onClick={() => handleGroupSelect(group.sgt_idx)}
                                      className={`w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 focus:outline-none focus:bg-indigo-50 transition-all duration-200 mobile-button ${
                                     selectedGroupId === group.sgt_idx 
                                          ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                       : 'text-gray-900'
                                   }`}
                                      whileHover={{ x: 4 }}
                                 >
                                   <div className="flex items-center justify-between">
                                     <span className="truncate">{group.sgt_title || `그룹 ${group.sgt_idx}`}</span>
                                     {selectedGroupId === group.sgt_idx && (
                                          <motion.span 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="text-indigo-500 ml-2"
                                          >
                                            ✓
                                          </motion.span>
                                     )}
                                   </div>
                                    </motion.button>
                               ))}
                                </motion.div>
                              </motion.div>
                           )}
                          </AnimatePresence>
                         </div>

                       </div>
                  </div>

                   {isLoading ? (
                      <div className="text-center py-8 text-gray-500">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-10 h-10 mx-auto mb-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center"
                        >
                          <FiLoader className="w-5 h-5 text-white" />
                        </motion.div>
                        <p className="font-medium">멤버 정보를 불러오는 중...</p>
                    </div>
                   ) : groupMembers.length > 0 ? (
                      <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-row flex-nowrap justify-start items-center gap-x-6 overflow-x-auto hide-scrollbar px-2 py-2"
                      >
                        {groupMembers.map((member, index) => (
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
                                className={`member-avatar w-11 h-11 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ${
                                  member.isSelected ? 'selected' : ''
                                }`}
                                animate={member.isSelected ? "selected" : undefined}
                              >
                               <img 
                                src={member.photo ?? getDefaultImage(member.mt_gender, member.original_index)} 
                                alt={member.name} 
                                  className="w-full h-full object-cover rounded-xl" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = getDefaultImage(member.mt_gender, member.original_index);
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
                        ))}
                      </motion.div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
              <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                          className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                          <FiMapPin className="w-8 h-8 text-gray-300" />
                        </motion.div>
                        <p className="font-medium">그룹에 참여한 멤버가 없습니다</p>
                        <p className="text-sm mt-1">그룹에 멤버를 초대해보세요</p>
                     </div>
                   )}
                  </motion.div>
              </div>

                {/* 다른 멤버들의 장소 뷰 */}
              <div className="w-full flex-shrink-0 snap-start">
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 border border-purple-100 h-[200px] overflow-y-auto hide-scrollbar"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">
                            {groupMembers.find((m: GroupMember) => m.isSelected)?.name ?
                              `${groupMembers.find((m: GroupMember) => m.isSelected)?.name}의 장소` : 
                              '다른 멤버들의 장소'
                            }
                  </h2>
                          <p className="text-sm text-gray-600">장소들을 확인하세요</p>
                        </div>
                        {isLoadingOtherLocations && (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <FiLoader className="text-purple-500" size={18}/>
                          </motion.div>
                        )}
                      </div>
                    </div>

                  {isLoadingOtherLocations ? (
                      <div className="text-center py-8 text-gray-500">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-10 h-10 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center"
                        >
                          <FiLoader className="w-5 h-5 text-white" />
                        </motion.div>
                        <p className="font-medium">다른 멤버 장소 로딩 중...</p>
                    </div>
                  ) : otherMembersSavedLocations.length > 0 ? (
                      <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className="flex overflow-x-auto space-x-4 pb-2 hide-scrollbar -mx-1 px-1"
                      >
                        {otherMembersSavedLocations.map((location, index) => {
                          const lat = parseFloat(String(location.slt_lat || '0')) || 0;
                          const lng = parseFloat(String(location.slt_long || '0')) || 0;
                          
                          console.log('[장소 렌더링]', location.name || location.slt_title, 'lat:', lat, 'lng:', lng);
                          
                          // 좌표가 없어도 장소 카드는 표시하되, 지도 이동만 제한
                          const locationId = location.slt_idx ? location.slt_idx.toString() : location.id;
                          const isSelected = selectedLocationIdRef.current === locationId;
                          const hasValidCoords = lat !== 0 || lng !== 0;
                        
                        return (
                            <motion.div 
                            key={location.slt_idx || location.id} 
                              custom={index}
                              variants={locationCardVariants}
                              initial="hidden"
                              animate="visible"
                              whileHover={!isSelected ? "hover" : undefined}
                              whileTap="tap"
                              className={`location-card flex-shrink-0 w-64 h-24 rounded-2xl p-4 cursor-pointer shadow-lg transition-all duration-300 ${
                                isSelected ? 'selected ring-2 ring-blue-400 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50' : 'hover:shadow-xl'
                              } ${!hasValidCoords ? 'opacity-75 border-dashed border-2 border-gray-300' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleLocationCardClick(location);
                              }}
                            >
                              {/* 상단: 제목과 버튼들 */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center min-w-0 flex-1">
                                  <motion.div
                                    whileHover={{ rotate: hasValidCoords ? 360 : 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`p-2 rounded-xl mr-3 flex-shrink-0 ${
                                      !hasValidCoords 
                                        ? 'bg-gradient-to-r from-gray-400 to-gray-500' 
                                        : isSelected 
                                          ? 'bg-pink-600 shadow-lg' 
                                          : 'bg-indigo-600'
                                    }`}
                                  >
                                    <FiMapPin className={`w-4 h-4 ${!hasValidCoords ? 'text-gray-200' : 'text-white'}`} />
                                  </motion.div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className={`text-sm font-bold truncate ${
                                      isSelected ? 'text-gray-800' : 'text-gray-800'
                                    }`}>
                                      {location.name || location.slt_title || '제목 없음'}
                                    </h4>
                                  </div>
                                </div>
                                
                                {/* 버튼들 */}
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNotificationToggle(location);
                                    }}
                                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                                      (location.notifications || (location as any).slt_enter_alarm === 'Y')
                                        ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100 border border-emerald-200' 
                                        : 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200'
                                    }`}
                                    title={`알림 ${(location.notifications || (location as any).slt_enter_alarm === 'Y') ? '끄기' : '켜기'}`}
                                  >
                                    {(location.notifications || (location as any).slt_enter_alarm === 'Y') ? (
                                      <FiBell size={14} />
                                    ) : (
                                      <FiBellOff size={14} />
                                    )}
                                  </motion.button>
                                  
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHideLocation(location);
                                    }}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-all duration-200"
                                    title="장소 숨김"
                                  >
                                    <FiTrash2 size={14} />
                                  </motion.button>
                                </div>
                              </div>
                              
                              {/* 하단: 주소 */}
                              <div className="flex-1">
                                <p className={`text-xs truncate ${
                                  isSelected ? 'text-gray-600' : 'text-gray-500'
                                }`}>
                                  {location.address || location.slt_add || '주소 정보 없음'}
                                  {!hasValidCoords && <span className="text-orange-500 ml-1">(위치 정보 없음)</span>}
                                </p>
                              </div>
                </motion.div>
                        );
                      })}
              </motion.div>
                    ) : (
                      <div className="bg-gradient-to-r from-indigo-50 to-pink-50 rounded-xl shadow-lg p-4 text-center text-gray-500 border border-gray-200">
                        <p className="font-medium">
                          {groupMembers.find((m: GroupMember) => m.isSelected)?.name ?
                            `${groupMembers.find((m: GroupMember) => m.isSelected)?.name}님이 등록한 장소가 없습니다.` : 
                            '다른 멤버들이 등록한 장소가 없습니다.'
                          }
                        </p>
                        <p className="text-sm mt-1">새로운 장소를 추가해보세요</p>
                  </div>
                  )}
                  </motion.div>
                    </div>
                      </div>

              {/* 개선된 스와이프 인디케이터 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex justify-center items-center my-6"
              >
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                    onClick={() => handleViewChange('selectedMemberPlaces')}
                  className={`w-3 h-3 rounded-full mx-2 focus:outline-none transition-all duration-300 ${
                    activeView === 'selectedMemberPlaces' 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg scale-125' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label="선택된 멤버 장소 뷰로 전환"
                />
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                    onClick={() => handleViewChange('otherMembersPlaces')}
                  className={`w-3 h-3 rounded-full mx-2 focus:outline-none transition-all duration-300 ${
                    activeView === 'otherMembersPlaces' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 shadow-lg scale-125' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label="다른 멤버 장소 뷰로 전환"
                />
              </motion.div>
              </div>
          </motion.div>
        )}

      </motion.div>

      {/* 커스텀 모달 */}
      <AnimatePresence>
        {isModalOpen && modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={closeModal} // 배경 클릭 시 닫기
          >
            <motion.div
              variants={modalVariants} // 기존 modalVariants 사용
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`relative p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4
                ${modalContent.type === 'success' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 
                  modalContent.type === 'error' ? 'bg-gradient-to-br from-red-500 to-rose-600' : 
                  'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}
              onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 전파 방지
            >
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/20"
              >
                <FiX size={20} />
              </button>
              
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6 shadow-inner"
                >
                  {modalContent.type === 'success' && <FiCheckCircle size={32} className="text-white" />}
                  {modalContent.type === 'error' && <FiXCircle size={32} className="text-white" />}
                  {modalContent.type === 'info' && <FiInfo size={32} className="text-white" />}
                </motion.div>

                <h3 className="text-2xl font-bold text-white mb-3 leading-tight">{modalContent.title}</h3>
                <p className="text-white/80 text-base mb-8 leading-relaxed">{modalContent.message}</p>

                {/* 버튼 영역 수정 */} 
                <div className="flex flex-col sm:flex-row gap-3">
                  {modalContent.onConfirm ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (modalContent.onConfirm) {
                            modalContent.onConfirm();
                          }
                          closeModal(); // 확인 후 모달 닫기
                        }}
                        className="w-full py-3 px-6 bg-white/90 hover:bg-white text-gray-800 font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                      >
                        {modalContent.type === 'info' ? '삭제 확인' : '확인'} {/* 삭제 확인 모달의 경우 버튼 텍스트 변경 */}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={closeModal} // 취소 버튼은 항상 모달만 닫음
                        className="w-full py-3 px-6 bg-transparent hover:bg-white/10 border border-white/30 text-white font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                      >
                        취소
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={closeModal}
                      className="w-full py-3 px-6 bg-white/90 hover:bg-white text-gray-800 font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      확인
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 
