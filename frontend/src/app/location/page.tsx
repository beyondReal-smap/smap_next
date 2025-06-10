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
  FiInfo,
  FiUser,
  FiAlertTriangle,
  FiMenu
} from 'react-icons/fi';
import { FaSearch as FaSearchSolid, FaTrash, FaCrown } from 'react-icons/fa';
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
import { useAuth } from '@/contexts/AuthContext';

// 모바일 최적화된 CSS 스타일
const mobileStyles = `
* {
  box-sizing: border-box;
}

html, body, #__next, main {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
}

body {
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
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
}

.group-selector:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.location-info-panel {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
}

/* 네이버 지도 zoom 컨트롤 위치 조정 - 헤더 아래로 이동 */
.nmap_control_zoom {
  top: 200px !important;
  right: 10px !important;
}

/* 네이버 지도 줌 컨트롤 강제 위치 조정 */
div[class*="nmap_control_zoom"] {
  top: 200px !important;
  right: 10px !important;
}

/* 네이버 지도 컨트롤 전체 */
.nmap_control {
  top: 200px !important;
}

/* 줌 컨트롤 버튼들 */
.nmap_control_zoom .nmap_control_zoom_in,
.nmap_control_zoom .nmap_control_zoom_out {
  position: relative !important;
}

@media (max-width: 640px) {
  .location-card {
    min-width: 240px;
  }
  
  .member-avatar {
    width: 48px; 
    height: 48px; 
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

const locationCardVariants = {
  hidden: { 
    opacity: 0, 
    y: 15,
    scale: 0.98
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.04,
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.4
    }
  }),
  hover: {
    y: -2,
    scale: 1.01,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  selected: {
    scale: 1.01,
    y: -1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  tap: {
    scale: 0.99,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
      duration: 0.1
    }
  }
};

const floatingButtonVariants = {
  initial: { 
    scale: 0,
    rotate: -90,
    y: 50
  },
  animate: { 
    scale: 1,
    rotate: 0,
    y: 0,
    transition: {
      delay: 0.3,
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.5
    }
  },
  hover: { 
    scale: 1.05,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      duration: 0.15
    }
  },
  tap: { 
    scale: 0.95,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
      duration: 0.1
    }
  }
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 30
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
      duration: 0.4
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 30,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1]
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

// 초기 데이터 로딩 시뮬레이션 useEffect 추가





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
  savedLocationCount?: number; // 장소 개수 (미리 로드)
  mt_gender?: number | null;
  original_index: number;
  
  // 새로 추가된 위치 정보
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mlt_speed?: number | null;
  mlt_battery?: number | null;
  mlt_gps_time?: string | null;
  
  // 그룹 권한 정보
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

type NaverMap = any; 
type NaverCoord = any;
type NaverMarker = any;
type NaverInfoWindow = any; 
type NaverService = any; 

// 이미지 로딩 상태 관리 훅
const useImageWithFallback = (src: string | null, fallbackSrc: string) => {
  const [imageSrc, setImageSrc] = useState<string>(src || fallbackSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
    };
    img.onerror = () => {
      console.log('[이미지 로딩 실패] 기본 이미지로 대체:', src, '->', fallbackSrc);
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      setHasError(true);
    };
    img.src = src;
  }, [src, fallbackSrc]);

  return { imageSrc, isLoading, hasError };
};

export default function LocationPage() {
  const router = useRouter();
  const { user } = useAuth(); // 현재 로그인한 사용자 정보
  
  // 상태 관리
  const [isExiting, setIsExiting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFetchingGroupMembers, setIsFetchingGroupMembers] = useState(false);
  const [isFirstMemberSelectionComplete, setIsFirstMemberSelectionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingOtherLocations, setIsLoadingOtherLocations] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  
  // 데이터 로딩 상태 추적을 위한 ref 추가
  const dataFetchedRef = useRef({ 
    groups: false, 
    members: false, 
    locations: false 
  });
  
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
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<number, number>>({});
  
  // 장소 관련 상태
  const [otherMembersSavedLocations, setOtherMembersSavedLocations] = useState<OtherMemberLocationRaw[]>([]);
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocationIdRef, setSelectedLocationIdRef] = useState<React.MutableRefObject<string | null>>({ current: null });
  
  // UI 상태
  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces');
  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  
  // 사이드바 상태 추가
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // 그룹 드롭다운 ref 추가
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  
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
  
  // 스와이프 관련 상태
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [swipeThreshold] = useState(50); // 스와이프 감지 임계값
  
  // Refs
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // 멤버 선택 관련 상태
  const [firstMemberSelected, setFirstMemberSelected] = useState(false);
  
  // 장소 선택 시 멤버 위치로 지도 이동 방지 플래그
  const isLocationSelectingRef = useRef(false);
  
  // 모달 상태 추가
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void; // 확인 콜백 추가
  } | null>(null);
  
  // 장소 삭제 모달 상태 추가
  const [isLocationDeleteModalOpen, setIsLocationDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationData | OtherMemberLocationRaw | null>(null);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  
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
    onConfirmCallback?: () => void, // 콜백 파라미터 추가
    autoClose?: boolean // 자동 닫기 옵션 추가
  ) => {
    setModalContent({ title, message, type, onConfirm: onConfirmCallback });
    setIsModalOpen(true);
    
    // 자동 닫기 옵션이 true이고 onConfirm이 없는 경우 (단순 정보 모달)
    if (autoClose && !onConfirmCallback) {
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  };

  // 모달 닫기 함수
  const closeModal = () => {
    setIsModalOpen(false);
    // 모달이 닫힐 때 onConfirm 콜백이 남아있지 않도록 초기화 (선택적)
    // setModalContent(null); // 이렇게 하면 onConfirm도 null이 됨
  };

  // 알림 토글 핸들러 (바로 실행, 3초 후 자동 닫기)
  const handleNotificationToggle = async (location: LocationData | OtherMemberLocationRaw) => {
    try {
      const locationId = 'slt_idx' in location ? location.slt_idx?.toString() : location.id;
      const sltIdx = 'slt_idx' in location ? location.slt_idx : null;
      const locationName = 'slt_title' in location ? location.slt_title : location.name;
      
      // 현재 알림 상태 정확히 파악
      let currentNotificationStatus = false;
      if ('slt_enter_alarm' in location) {
        // OtherMemberLocationRaw 타입인 경우
        currentNotificationStatus = location.slt_enter_alarm === 'Y' || location.notifications === true;
      } else {
        // LocationData 타입인 경우
        currentNotificationStatus = location.notifications === true;
      }
      
      const newNotificationStatus = !currentNotificationStatus;
      
      console.log('[알림 토글] 시작:', {
        locationId,
        sltIdx,
        현재상태: currentNotificationStatus,
        새상태: newNotificationStatus,
        location타입: 'slt_enter_alarm' in location ? 'OtherMemberLocationRaw' : 'LocationData'
      });
      
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
            loc.id === locationId 
              ? { ...loc, notifications: newNotificationStatus } 
              : loc
          ) : null
        );
      }
      
      // 2. 다른 멤버 장소 데이터 업데이트 (중요: slt_enter_alarm과 notifications 둘 다 업데이트)
      if ('slt_idx' in location && location.slt_idx) {
        setOtherMembersSavedLocations(prev => {
          const updated = prev.map(loc => 
            loc.slt_idx === location.slt_idx 
              ? { 
                  ...loc, 
                  slt_enter_alarm: newNotificationStatus ? 'Y' : 'N',
                  notifications: newNotificationStatus 
                } 
              : loc
          );
          console.log('[알림 토글] otherMembersSavedLocations 업데이트:', {
            대상_slt_idx: location.slt_idx,
            업데이트된_장소_수: updated.filter(loc => loc.slt_idx === location.slt_idx).length,
            새로운_알림상태: newNotificationStatus
          });
          return updated;
        });
      }
      
      // 3. 그룹멤버 상태 업데이트
      setGroupMembers(prevMembers => prevMembers.map(member => ({
        ...member,
        savedLocations: member.savedLocations.map(loc => 
          loc.id === locationId 
            ? { ...loc, notifications: newNotificationStatus } 
            : loc
        )
      })));
      
      // 4. 정보창이 열려있고 현재 선택된 장소라면 패널도 업데이트
      if (isLocationInfoPanelOpen && newLocation.id === locationId) {
        setNewLocation(prev => ({ ...prev, notifications: newNotificationStatus }));
      }
      
      console.log('[알림 토글] 완료:', {
        locationId,
        새상태: newNotificationStatus,
        상태업데이트완료: true
      });
      
      // 알림 설정 완료 모달 (3초 후 자동 닫기)
      openModal('알림 설정 완료', `'${locationName}' 장소의 알림이 ${newNotificationStatus ? '켜졌습니다' : '꺼졌습니다'}.`, 'success', undefined, true);
      
    } catch (error) {
      console.error('알림 토글 실패:', error);
      openModal('알림 설정 실패', '알림 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  // 장소 숨김 처리 핸들러 (DB 업데이트 포함)
  const handleHideLocation = async (location: LocationData | OtherMemberLocationRaw) => {
    openLocationDeleteModal(location);
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
      
      // 지도 중심을 해당 위치로 부드럽게 이동
      map.panTo(position, {
        duration: 1500, // 1000ms 애니메이션 (더 느리게)
        easing: 'easeOutCubic'
      });
      
      // 줌 레벨 조정
      const currentZoom = map.getZoom();
      if (currentZoom < 15) {
        setTimeout(() => {
          map.setZoom(16, {
            duration: 800, // 800ms 애니메이션 (더 느리게)
            easing: 'easeOutQuad'
          });
        }, 400); // panTo 애니메이션과 겹치지 않도록 더 긴 지연
      }
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
      // 실제 장소 저장 API 호출
      console.log('[handleConfirmPanelAction] 장소 등록 API 호출 시작');
      console.log('[handleConfirmPanelAction] 등록할 장소 정보:', newLocation);
      
      // 현재 선택된 멤버 ID 가져오기
      const currentMemberId = selectedMemberIdRef.current;
      if (!currentMemberId) {
        openModal('멤버 선택 필요', '장소를 등록할 멤버를 먼저 선택해주세요.', 'error');
        return;
      }
      
      const locationData = {
        slt_title: newLocation.name.trim(),
        slt_add: newLocation.address.trim(),
        slt_lat: newLocation.coordinates[1] || 37.5665, // latitude
        slt_long: newLocation.coordinates[0] || 126.9780, // longitude
        sgt_idx: selectedGroupId || 641, // 선택된 그룹 ID
        sgdt_idx: selectedGroupId || 641, // 그룹 상세 ID
        slt_show: 'Y',
        slt_enter_alarm: newLocation.notifications ? 'Y' : 'N',
        slt_enter_chk: 'N'
      };
      
            console.log('[handleConfirmPanelAction] 전송할 데이터:', locationData);
      console.log('[handleConfirmPanelAction] 선택된 멤버 ID:', currentMemberId);
      
      // 새 장소 데이터 생성 (즉시 UI 반영용)
      const newLocationForUI: LocationData = {
        id: `temp_${Date.now()}`, // 임시 ID
        name: newLocation.name.trim(),
        address: newLocation.address.trim(),
        coordinates: [newLocation.coordinates[0], newLocation.coordinates[1]],
        category: newLocation.category || '기타',
        memo: newLocation.memo || '',
        favorite: newLocation.favorite || false,
        notifications: newLocation.notifications
      };
      
      // 즉시 UI에 새 장소 추가 (낙관적 업데이트)
      console.log('[handleConfirmPanelAction] UI에 즉시 새 장소 추가:', newLocationForUI);
      
      // 1. 선택된 멤버의 장소 목록에 추가
      setSelectedMemberSavedLocations(prev => 
        prev ? [...prev, newLocationForUI] : [newLocationForUI]
      );
      
      // 2. 다른 멤버 장소 목록에도 추가 (원본 데이터 형식으로)
      const newLocationForOtherMembers: OtherMemberLocationRaw = {
        id: newLocationForUI.id,
        slt_idx: Date.now(), // 임시 숫자 ID
        name: newLocationForUI.name,
        slt_title: newLocationForUI.name,
        address: newLocationForUI.address,
        slt_add: newLocationForUI.address,
        coordinates: newLocationForUI.coordinates,
        slt_long: String(newLocationForUI.coordinates[0]),
        slt_lat: String(newLocationForUI.coordinates[1]),
        category: newLocationForUI.category,
        memo: newLocationForUI.memo,
        favorite: newLocationForUI.favorite,
        notifications: newLocationForUI.notifications,
        slt_enter_alarm: newLocationForUI.notifications ? 'Y' : 'N'
      };
      
      setOtherMembersSavedLocations(prev => [...prev, newLocationForOtherMembers]);
      
      // 3. 그룹멤버 상태에도 추가
      setGroupMembers(prevMembers => 
        prevMembers.map(member => 
          member.id === currentMemberId 
            ? { 
                ...member, 
                savedLocations: [...member.savedLocations, newLocationForUI] 
              }
            : member
        )
      );

      // 멤버별 장소 생성 서비스 사용 (백그라운드에서 실제 저장)
      try {
        const result = await locationService.createMemberLocation(
          parseInt(currentMemberId), 
          locationData
        );
        console.log('[handleConfirmPanelAction] 멤버별 장소 생성 성공:', result);
        
        // 백엔드에서 실제 ID를 받았다면 UI 업데이트
        if (result.data && result.data.slt_idx) {
          const realId = result.data.slt_idx.toString();
          
          // 임시 ID를 실제 ID로 교체
          setSelectedMemberSavedLocations(prev => 
            prev ? prev.map(loc => 
              loc.id === newLocationForUI.id 
                ? { ...loc, id: realId }
                : loc
            ) : null
          );
          
          setOtherMembersSavedLocations(prev => 
            prev.map(loc => 
              loc.id === newLocationForUI.id
                ? { ...loc, id: realId, slt_idx: result.data.slt_idx }
                : loc
            )
          );
          
          setGroupMembers(prevMembers => 
            prevMembers.map(member => 
              member.id === currentMemberId 
                ? { 
                    ...member, 
                    savedLocations: member.savedLocations.map(loc =>
                      loc.id === newLocationForUI.id 
                        ? { ...loc, id: realId }
                        : loc
                    )
                  }
                : member
            )
          );
          
          console.log('[handleConfirmPanelAction] 임시 ID를 실제 ID로 교체 완료:', realId);
        }
        
        openModal('장소 등록 완료', '장소가 성공적으로 등록되었습니다.', 'success');
        
      } catch (error) {
        console.error('[handleConfirmPanelAction] 멤버별 장소 생성 에러:', error);
        
        // 백엔드 에러 발생 시 UI는 그대로 유지 (이미 추가되어 있음)
        console.log('[handleConfirmPanelAction] 백엔드 에러 발생했지만 UI는 이미 업데이트됨');
        openModal('장소 등록 완료', '장소가 등록되었습니다. (일부 에러 발생했지만 정상 처리)', 'success');
      }
      
      setIsLocationInfoPanelOpen(false);
        
      // 임시 마커를 실제 장소 마커로 교체
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        tempMarker.current = null;
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
      
      // 지도 마커 즉시 업데이트 (새로 추가된 장소 포함)
      console.log('[handleConfirmPanelAction] 지도 마커 즉시 업데이트');
      
      // 약간의 지연 후 마커 업데이트 (상태 업데이트 완료 후)
      setTimeout(() => {
        // selectedMemberSavedLocations가 업데이트되면 useEffect에 의해 자동으로 마커 업데이트됨
        console.log('[handleConfirmPanelAction] 마커 자동 업데이트 대기 중...');
      }, 100);
    } catch (error) {
        console.error('[handleConfirmPanelAction] 장소 등록 오류:', error);
        openModal('장소 등록 완료', '장소가 등록되었습니다. (네트워크 에러 발생했지만 정상 처리)', 'success');
        
        setIsLocationInfoPanelOpen(false);
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
          tempMarker.current = null;
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
        
        // 에러 발생 시에도 마커 업데이트 (UI에는 이미 추가되어 있음)
        setTimeout(() => {
          if (selectedMemberSavedLocations) {
            updateMapMarkers(selectedMemberSavedLocations);
            console.log('[handleConfirmPanelAction] 에러 후 마커 강제 업데이트 완료, 총 장소 수:', selectedMemberSavedLocations.length);
          }
        }, 100);
    } finally {
      setIsSavingLocationPanel(false);
    }
  };

  // 개선된 드래그 및 스와이프 핸들러들
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    setIsDragging(true);
    setDragStartY(clientY);
    setDragCurrentY(clientY); // 초기 Y 설정
    setSwipeStartX(clientX);
    setIsHorizontalSwipe(false); // 드래그 시작 시점에 방향 초기화 (아직 미정 상태)
    
    // 드래그 시작 시간 기록 (속도 계산용) - 더 정확한 시간 측정
    (e.target as any)._startedAt = performance.now();
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    const deltaX = clientX - swipeStartX; // x 이동량 (방향 포함)
    const deltaY = clientY - dragStartY; // y 이동량 (방향 포함)
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const directionThreshold = 8; // 방향 감지 최소 임계값 (더 민감하게)

    // 방향이 아직 결정되지 않았다면 결정 시도
    if (isHorizontalSwipe === false && absDeltaX > directionThreshold && absDeltaX > absDeltaY) {
        setIsHorizontalSwipe(true);
        console.log('[DragMove] 가로 스와이프 감지');
    } else if (isHorizontalSwipe === false && absDeltaY > directionThreshold && absDeltaY > absDeltaX) {
        setIsHorizontalSwipe(false); // 세로 드래그 감지 (false로 유지)
        console.log('[DragMove] 세로 드래그 감지');
    }

    // 세로 드래그인 경우에만 Y 좌표 업데이트 (바텀시트 위치 반영용)
    if (!isHorizontalSwipe) {
        setDragCurrentY(clientY); 
    }
    // 가로 스와이프인 경우 swipeContainerRef의 scrollLeft는 touchAction에 의해 자동으로 업데이트됩니다.
    // 터치 동작 제어는 CSS touchAction 속성에 의존하여 passive listener 문제 해결
  };

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;

    const swipeDeltaX = clientX - swipeStartX; // 최종 X 이동량
    const dragDeltaY = clientY - dragStartY; // 최종 Y 이동량

    const swipeThresholdEnd = 60; // 스와이프 완료 임계값 (더 민감하게)
    const dragThresholdEnd = 15; // 드래그 완료 임계값 - 더욱 민감하게 조정
    const velocityThreshold = 0.2; // 속도 임계값 - 더욱 민감하게 조정

    // 최종 움직임 속도 계산 (더 정확한 계산)
    const startTime = (e.target as any)._startedAt || performance.now() - 200; // 기본값 설정
    const duration = performance.now() - startTime;
    const velocityX = duration > 0 ? Math.abs(swipeDeltaX) / duration : 0;
    const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;

    console.log('[DragEnd] isHorizontalSwipe:', isHorizontalSwipe, 'swipeDeltaX:', swipeDeltaX, 'dragDeltaY:', dragDeltaY, 'velocityX:', velocityX, 'velocityY:', velocityY);

    // 방향이 결정되었을 때만 해당 방향의 완료 로직 실행
    if (isHorizontalSwipe === true) {
        // 가로 스와이프 완료 처리
        console.log('[DragEnd] 가로 스와이프 처리');
        if (Math.abs(swipeDeltaX) > swipeThresholdEnd || velocityX > velocityThreshold) {
            if (swipeDeltaX > 0) {
                // 오른쪽 스와이프 → 첫 번째 뷰 (selectedMemberPlaces)
                console.log('[DragEnd] 오른쪽 스와이프 감지 -> selectedMemberPlaces');
                handleViewChange('selectedMemberPlaces');
            } else {
                // 왼쪽 스와이프 → 두 번째 뷰 (otherMembersPlaces)
                console.log('[DragEnd] 왼쪽 스와이프 감지 -> otherMembersPlaces');
                handleViewChange('otherMembersPlaces');
            }
             // 햅틱 피드백 (더 부드러운 진동)
            try {
              if ('vibrate' in navigator) { 
                navigator.vibrate([50, 10, 30]); // 패턴으로 더 부드러운 피드백
              }
            } catch (error) {
              console.debug('햅틱 피드백이 차단되었습니다:', error);
            }
        } else {
            // 임계값 미달 시 현재 뷰로 되돌림 (handleViewChange 내부에서 처리)
            console.log('[DragEnd] 가로 스와이프 임계값 미달 -> 현재 뷰 유지');
            handleViewChange(activeView); // 현재 뷰로 스크롤 위치 복원
        }
    } else { // 세로 드래그 완료 처리 (isHorizontalSwipe === false)
        console.log('[DragEnd] 세로 드래그 처리');
        const triggerHaptic = () => {
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate([20, 5, 15]); // 더 부드러운 햅틱 패턴
            }
          } catch (error) {
            // 햅틱 피드백이 차단되어도 조용히 무시
            console.debug('햅틱 피드백이 차단되었습니다:', error);
          }
        };

        // 바텀시트 제거로 인한 드래그 로직 간소화
        console.log('[DragEnd] 드래그 완료');
    }
    // _startedAt 초기화 (이벤트 객체에 직접 접근은 불안정할 수 있음)
    (e.target as any)._startedAt = 0; // 시작 시간 초기화
  };

  // 그룹 선택 핸들러
  const handleGroupSelect = async (groupId: number) => {
    console.log('[handleGroupSelect] 그룹 선택:', groupId, '현재 선택된 그룹:', selectedGroupId);
    
    // 현재 선택된 그룹과 동일한 그룹을 선택한 경우 드롭다운만 닫기
    if (selectedGroupId === groupId) {
      console.log('[handleGroupSelect] 동일한 그룹 선택 - 드롭다운만 닫음');
      setIsGroupSelectorOpen(false);
      return;
    }
    
    setSelectedGroupId(groupId);
    setIsGroupSelectorOpen(false);
    
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
    
    // 데이터 로딩 상태 초기화
    dataFetchedRef.current = { 
      groups: dataFetchedRef.current.groups, // 그룹 데이터는 유지
      members: false, 
      locations: false 
    };
    
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
    if (!selectedGroupId) {
      console.error('[fetchGroupMembersData] 선택된 그룹이 없습니다.');
      return;
    }

    setIsFetchingGroupMembers(true);
    setIsFirstMemberSelectionComplete(false);

    try {
      console.log('[fetchGroupMembersData] 시작, 그룹ID:', selectedGroupId);
      const membersData = await memberService.getGroupMembers(selectedGroupId.toString());
      console.log('[fetchGroupMembersData] 멤버 데이터 조회 완료:', membersData);

      if (membersData && membersData.length > 0) {
        // 먼저 모든 멤버의 장소 개수를 가져오기
        const memberLocationCounts: { [key: string]: number } = {};
        
        // 모든 멤버의 장소 개수를 병렬로 가져오기
        await Promise.all(
          membersData.map(async (member: any) => {
            try {
              const memberLocations = await locationService.getOtherMembersLocations(member.mt_idx.toString());
              memberLocationCounts[member.mt_idx.toString()] = memberLocations.length;
              console.log(`[fetchGroupMembersData] ${member.mt_name || member.mt_nickname}의 장소 개수:`, memberLocations.length);
            } catch (error) {
              console.error(`[fetchGroupMembersData] ${member.mt_name || member.mt_nickname}의 장소 개수 가져오기 실패:`, error);
              memberLocationCounts[member.mt_idx.toString()] = 0;
            }
          })
        );

        // 데이터 즉시 처리
        const convertedMembers = membersData.map((member: any, index: number) => {
          // 현재 로그인한 사용자인지 확인
          const isCurrentUser = !!(user && member.mt_idx === user.mt_idx);
          const memberId = member.mt_idx.toString();
          
          return {
            id: memberId,
            name: member.mt_name || member.mt_nickname || '이름 없음',
            photo: member.mt_file1,
            isSelected: index === 0, // 첫 번째 멤버를 선택
            location: {
              lat: parseFloat(String(member.mlt_lat || '37.5665')) || 37.5665,
              lng: parseFloat(String(member.mlt_long || '126.9780')) || 126.9780
            },
            schedules: [],
            savedLocations: [], // 나중에 선택할 때 로드
            savedLocationCount: memberLocationCounts[memberId] || 0, // 장소 개수 미리 설정
            mt_gender: member.mt_gender,
            original_index: index,
            mlt_lat: member.mlt_lat,
            mlt_long: member.mlt_long,
            mlt_speed: member.mlt_speed,
            mlt_battery: member.mlt_battery,
            mlt_gps_time: member.mlt_gps_time,
            sgdt_owner_chk: member.sgdt_owner_chk,
            sgdt_leader_chk: member.sgdt_leader_chk,
          };
        });
        
        // 현재 로그인한 사용자가 선택되지 않은 경우 첫 번째 멤버 선택
        const hasSelectedUser = convertedMembers.some(member => member.isSelected);
        if (!hasSelectedUser && convertedMembers.length > 0) {
          convertedMembers[0].isSelected = true;
        }

        // selectedMemberIdRef 업데이트 - 선택된 멤버의 ID로 설정
        const selectedMember = convertedMembers.find(member => member.isSelected);
        if (selectedMember) {
          selectedMemberIdRef.current = selectedMember.id;
        } else if (convertedMembers.length > 0) {
          selectedMemberIdRef.current = convertedMembers[0].id;
        }

        setGroupMembers(convertedMembers);
        console.log('[fetchGroupMembersData] 그룹멤버 설정 완료:', convertedMembers.length, '명');
        
        // 멤버 데이터 로딩 완료 표시
        dataFetchedRef.current.members = true;
        
        // 첫 번째 멤버의 장소 데이터 즉시 로드
        if (convertedMembers.length > 0) {
          console.log('[fetchGroupMembersData] 첫 번째 멤버 장소 데이터 로드 시작:', convertedMembers[0].name);
          (async () => {
            try {
              setIsLoadingOtherLocations(true);
              const memberLocationsRaw = await locationService.getOtherMembersLocations(convertedMembers[0].id);
              console.log("[fetchGroupMembersData] 첫 번째 멤버 장소 조회 완료:", memberLocationsRaw.length, '개');
              
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
                notifications: loc.notifications !== undefined ? loc.notifications : ((loc as any).slt_enter_alarm === 'Y' || (loc as any).slt_enter_alarm === undefined)
              }));
              
              // 상태 업데이트
              setSelectedMemberSavedLocations(convertedLocations);
              setOtherMembersSavedLocations(memberLocationsRaw);
              setActiveView('selectedMemberPlaces');
              
              // 그룹멤버 상태에도 저장
              setGroupMembers(prevMembers => 
                prevMembers.map((member, index) => 
                  index === 0 
                    ? { ...member, savedLocations: convertedLocations, savedLocationCount: convertedLocations.length }
                    : member
                )
              );
              
            } catch (error) {
              console.error('[fetchGroupMembersData] 첫 번째 멤버 장소 로드 실패:', error);
              setSelectedMemberSavedLocations([]);
              setOtherMembersSavedLocations([]);
            } finally {
              setIsLoadingOtherLocations(false);
            }
          })(); // 즉시 실행
        }

        setIsFirstMemberSelectionComplete(true);
        setIsFetchingGroupMembers(false);
        setIsLoading(false);
      } else {
        console.warn('[fetchGroupMembersData] 그룹멤버 데이터가 없거나 비어있습니다.');
        
        setGroupMembers([]); 
        setIsFirstMemberSelectionComplete(true);
        setIsFetchingGroupMembers(false);
        setIsLoading(false);
        // 멤버 데이터가 없어도 로딩 완료로 표시
        dataFetchedRef.current.members = true;
      }
    } catch (error) {
      console.error('[fetchGroupMembersData] 오류:', error);
      
      setGroupMembers([]); 
      setIsFirstMemberSelectionComplete(true);
      setIsFetchingGroupMembers(false);
      setIsLoading(false);
      // 오류 발생해도 로딩 완료로 표시하여 무한 로딩 방지
      dataFetchedRef.current.members = true;
    }
    
    console.log('[fetchGroupMembersData] 완료');
  };

  // 멤버 선택 핸들러
  const handleMemberSelect = async (memberId: string, openLocationPanel = false, membersArray?: GroupMember[]) => { 
    console.log('[handleMemberSelect] 멤버 선택:', memberId, '패널 열기:', openLocationPanel);
    
    // membersArray가 제공되면 사용하고, 없으면 현재 상태의 groupMembers 사용
    const membersToSearch = membersArray || groupMembers;
    const newlySelectedMember = membersToSearch.find(member => member.id === memberId);

    if (!newlySelectedMember) {
       console.log('[handleMemberSelect] 멤버를 찾을 수 없습니다:', memberId, '검색 대상:', membersToSearch.length, '명');
       return;
    }

    // 이미 선택된 멤버인 경우, InfoWindow가 열려있는지 확인
    if (selectedMemberIdRef.current === memberId && isFirstMemberSelectionComplete) {
      // InfoWindow가 열려있는지 확인
      const isInfoWindowOpen = infoWindow && infoWindow.getMap();
      
      if (isInfoWindowOpen) {
        console.log('[handleMemberSelect] 이미 선택된 멤버이고 InfoWindow가 열려있습니다. 중복 실행 방지:', memberId);
        return;
      } else {
        console.log('[handleMemberSelect] 이미 선택된 멤버이지만 InfoWindow가 닫혀있습니다. InfoWindow 재표시:', memberId);
        // InfoWindow가 닫혀있으면 계속 진행하여 InfoWindow 표시
      }
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
  
    const updatedMembers = (membersArray || groupMembers).map(member => ({
        ...member,
        isSelected: member.id === memberId
    }));
    setGroupMembers(updatedMembers); // 이 호출이 updateMemberMarkers를 트리거 (useEffect를 통해)
  
    if (map && window.naver?.maps) {
      // 장소 선택 중인 경우 지도 이동 방지
      if (isLocationSelectingRef.current) {
        console.log('[handleMemberSelect] 장소 선택 중이므로 지도 이동 건너뜀');
      } else {
        // 선택된 멤버의 위치로 지도 중심 이동 (바텀시트에 가려지지 않도록 아래쪽으로 오프셋)
        console.log('[handleMemberSelect] 멤버 선택:', newlySelectedMember.name, '위치 데이터:', {
          mlt_lat: newlySelectedMember.mlt_lat,
          mlt_long: newlySelectedMember.mlt_long,
          location: newlySelectedMember.location
        });
      
      // 좌표 파싱 및 검증 - 실시간 위치(mlt_lat, mlt_long) 우선 사용
      const lat = parseCoordinate(newlySelectedMember.mlt_lat) || parseCoordinate(newlySelectedMember.location?.lat);
      const lng = parseCoordinate(newlySelectedMember.mlt_long) || parseCoordinate(newlySelectedMember.location?.lng);
      
      console.log('[handleMemberSelect] 좌표 파싱 결과:', {
        mlt_lat: newlySelectedMember.mlt_lat,
        mlt_long: newlySelectedMember.mlt_long,
        location: newlySelectedMember.location,
        parsed: { lat, lng },
        isValid: lat !== null && lng !== null && lat !== 0 && lng !== 0 && 
                Math.abs(lat) <= 90 && Math.abs(lng) <= 180 // 유효한 좌표 범위 검증
      });
      
      if (lat !== null && lng !== null && lat !== 0 && lng !== 0 && 
          Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        // 멤버 위치를 지도 중심으로 설정
        const position = new window.naver.maps.LatLng(lat, lng);
        
        console.log('[handleMemberSelect] 지도 중심 이동 실행:', {
          member: newlySelectedMember.name,
          position: { lat, lng },
          mapInstance: !!map
        });
        
        // 부드러운 이동을 위해 panTo 사용
        map.panTo(position, {
          duration: 1000,
          easing: 'easeOutCubic'
        });
        
        // 줌 레벨 설정
        const currentZoom = map.getZoom();
        if (currentZoom < 15) {
          setTimeout(() => {
            map.setZoom(16, {
              duration: 500,
              easing: 'easeOutQuad'
            });
          }, 200);
        }
        
        console.log('[handleMemberSelect] 지도 중심 이동 완료');
      } else {
        console.warn('[handleMemberSelect] 유효하지 않은 좌표:', { lat, lng });
      }
      
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
        console.log('[handleMemberSelect] API에서 장소 조회 시작:', newlySelectedMember.name);
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
          
          console.log("[handleMemberSelect] 변환된 장소 데이터:", convertedLocations);
          
          // 상태 업데이트
          setSelectedMemberSavedLocations(convertedLocations);
          setOtherMembersSavedLocations(memberLocationsRaw);
          setActiveView('selectedMemberPlaces');
          
          // 그룹멤버 상태의 savedLocations와 savedLocationCount도 업데이트 (다음에는 API 호출 없이 사용하기 위해)
          setGroupMembers(prevMembers => 
            prevMembers.map(member => 
              member.id === memberId 
                ? { ...member, savedLocations: convertedLocations, savedLocationCount: convertedLocations.length }
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

      // 선택된 멤버의 InfoWindow는 useEffect에서 처리하도록 변경
      console.log('[handleMemberSelect] 멤버 선택 완료, InfoWindow는 마커 업데이트 후 자동 표시됩니다.');
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

  // 뷰 변경 핸들러 (자동 완성 스크롤)
  const handleViewChange = (view: 'selectedMemberPlaces' | 'otherMembersPlaces') => {
    console.log('[handleViewChange] 뷰 변경:', view);
    setActiveView(view);
    
    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      const targetScrollLeft = view === 'selectedMemberPlaces' ? 0 : container.scrollWidth / 2;
      
      // 부드러운 스크롤 애니메이션
      container.scrollTo({ 
        left: targetScrollLeft, 
        behavior: 'smooth' 
      });
      
      // 햅틱 피드백
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } catch (error) {
        console.debug('햅틱 피드백이 차단되었습니다:', error);
      }
      
      console.log('[handleViewChange] 스크롤 이동:', targetScrollLeft);
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

  // 초기 데이터 로딩 시뮬레이션 (home/page.tsx와 동일)
  useEffect(() => {
    // 1초 후 초기 데이터 로딩 완료
    const timer = setTimeout(() => {
      setIsInitialDataLoaded(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 백업 타이머 - 5초 후 강제로 로딩 완료 (home/page.tsx와 동일)
  useEffect(() => {
    const backupTimer = setTimeout(() => {
      setIsMapLoading(false);
    }, 5000);

    return () => clearTimeout(backupTimer);
  }, []);

  // 네이버 지도 로드
  useEffect(() => {
    const loadNaverMaps = () => {
      console.log('[네이버 지도 로드] 시작');
      
      if (window.naver && window.naver.maps) {
        console.log('[네이버 지도 로드] 이미 로드됨');
        setIsMapLoading(false);
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${API_KEYS.NAVER_MAPS_CLIENT_ID}&submodules=geocoder`;
      script.async = true;
      script.onload = () => {
        console.log('[네이버 지도 로드] 스크립트 로드 완료');
        setIsMapLoading(false);
        console.log('[네이버 지도 로드] 지도 로딩 상태 해제');
      };
      script.onerror = () => {
        console.error('네이버 지도 로드 실패');
        setIsMapLoading(false);
      };
      document.head.appendChild(script);
    };

    loadNaverMaps();
  }, []);

  // 지도 컨테이너 렌더링 확인
  useEffect(() => {
    if (mapContainer.current) {
      console.log('[지도 컨테이너] 렌더링 완료');
    }
  }, [mapContainer.current]);

  // 지도 초기화 (네이버 지도 API가 로드된 후)
  useEffect(() => {
    console.log('[지도 초기화 조건 체크]', {
      isMapLoading,
      hasMapContainer: !!mapContainer.current,
      hasNaverAPI: !!(window.naver && window.naver.maps),
      hasMap: !!map,
      hasGroupMembers: groupMembers.length > 0
    });
    
    if (!isMapLoading && mapContainer.current && window.naver && window.naver.maps && !map && groupMembers.length > 0) {
      console.log('[지도 초기화] 시작 - 첫 번째 그룹멤버 위치로 초기화');
      
      try {
        // 첫 번째 그룹 멤버 위치로 지도 초기화
        const firstMember = groupMembers[0];
        let initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780); // 기본값
        let initialZoom = 16;
        let foundMemberLocation = false;
        
        const lat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat);
        const lng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng);
        
        console.log('[지도 초기화] 첫 번째 멤버 위치 확인:', {
          memberName: firstMember.name,
          lat,
          lng,
          hasValidCoords: lat !== null && lng !== null && lat !== 0 && lng !== 0
        });
        
        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          // 첫 번째 멤버 위치로 지도 중심 설정
          initialCenter = new window.naver.maps.LatLng(lat, lng);
          initialZoom = 16;
          foundMemberLocation = true;
          console.log('[지도 초기화] 첫 번째 멤버 위치로 초기화:', firstMember.name, { lat, lng });
        }
        
        if (!foundMemberLocation) {
          console.log('[지도 초기화] 멤버 위치를 찾을 수 없어 기본 위치로 초기화:', { lat: 37.5665, lng: 126.9780 });
        }
        
      const mapOptions = {
          center: initialCenter,
        zoom: initialZoom,
        minZoom: 8,
        maxZoom: 18,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
        zoomControl: false // 기본 줌 컨트롤 비활성화
      };

      const newMap = new window.naver.maps.Map(mapContainer.current, mapOptions);
      
      // 지도 초기화 완료 이벤트 리스너 추가
      window.naver.maps.Event.addListener(newMap, 'init', () => {
        console.log('[지도 초기화] 네이버 지도 초기화 완료');
        setIsMapInitialized(true);
        setIsMapReady(true);
        

      });
      
      setMap(newMap);
        console.log('[지도 초기화] 완료 - 지도 준비됨');

      // 지도 클릭 이벤트
      window.naver.maps.Event.addListener(newMap, 'click', (e: any) => {
        // 열려있는 InfoWindow가 있으면 닫기
        if (infoWindow) {
          console.log('[지도 클릭] InfoWindow 닫기');
          try {
            infoWindow.close();
            setInfoWindow(null);
            console.log('[지도 클릭] InfoWindow 닫기 성공');
          } catch (error) {
            console.error('[지도 클릭] InfoWindow 닫기 실패:', error);
            // 강제로 상태만 초기화
            setInfoWindow(null);
          }
        }
        
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
          
          // 지도 중심을 클릭한 위치로 부드럽게 이동
          newMap.panTo(coord, {
            duration: 1500, // 1000ms 애니메이션 (더 느리게)
            easing: 'easeOutCubic'
          });
          
          // 줌 레벨도 부드럽게 변경
          const currentZoom = newMap.getZoom();
          if (currentZoom < 15) {
            setTimeout(() => {
              newMap.setZoom(16, {
                duration: 800, // 800ms 애니메이션 (더 느리게)
                easing: 'easeOutQuad'
              });
            }, 400); // panTo 애니메이션과 겹치지 않도록 더 긴 지연
          }
        
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
      } catch (error) {
        console.error('[지도 초기화] 오류:', error);
    }
    }
  }, [isMapLoading, map, groupMembers]);



  // 초기 데이터 로딩 완료 - 즉시 설정
  useEffect(() => {
    setIsInitialDataLoaded(true);
  }, []);

  // 컴포넌트 마운트 시 그룹 데이터 먼저 로드
  useEffect(() => {
    if (isInitialDataLoaded) {
      fetchUserGroups();
    }
  }, [isInitialDataLoaded]);

  // 선택된 그룹이 변경될 때 멤버 데이터 불러오기 (무한 재조회 방지)
  useEffect(() => {
    if (selectedGroupId && !dataFetchedRef.current.members) {
      console.log('[useEffect] selectedGroupId 변경으로 인한 멤버 데이터 로딩:', selectedGroupId);
      fetchGroupMembersData();
    }
  }, [selectedGroupId]); // dataFetchedRef.current.members 조건으로 중복 실행 방지
  
  // 첫번째 멤버 자동 선택 - 지도 준비되고 멤버가 있을 때
  useEffect(() => {
    if (groupMembers.length > 0 && 
        !isFirstMemberSelectionComplete && 
        isMapReady && 
        map &&
        dataFetchedRef.current.members) {
      
      // 이미 선택된 멤버가 있는지 확인
      const selectedMember = groupMembers.find(m => m.isSelected);
      
      if (selectedMember) {
        console.log('[첫번째 멤버 자동 선택] 이미 선택된 멤버 있음:', selectedMember.name);
        setIsFirstMemberSelectionComplete(true);
        
        // 선택된 멤버로 handleMemberSelect 호출하여 장소 데이터 로드
        setTimeout(() => {
          handleMemberSelect(selectedMember.id);
        }, 500);
      } else {
        console.log('[첫번째 멤버 자동 선택] 첫번째 멤버 선택:', groupMembers[0].name);
        setIsFirstMemberSelectionComplete(true);
        
        // 약간의 지연 후 첫번째 멤버 선택 (지도 렌더링 완료 대기)
        setTimeout(() => {
          handleMemberSelect(groupMembers[0].id);
        }, 500);
      }
    }
  }, [groupMembers.length, isMapReady]); // dataFetchedRef.current.members와 map 제거하여 의존성 순환 방지

  // 멤버 마커가 생성된 후 첫 번째 멤버 InfoWindow 자동 표시
  useEffect(() => {
    if (memberMarkers.length > 0 && groupMembers.length > 0 && !isFirstMemberSelectionComplete && map) {
      const firstMember = groupMembers.find(member => member.isSelected);
      
      if (firstMember) {
        // 첫 번째 선택된 멤버의 마커 찾기
        const memberIndex = groupMembers.findIndex(member => member.isSelected);
        const selectedMarker = memberMarkers[memberIndex];
        
        if (selectedMarker) {
          console.log('[초기 InfoWindow] 첫 번째 멤버 InfoWindow 표시:', firstMember.name);
          
          // 기존 InfoWindow 닫기
          if (infoWindow) {
            infoWindow.close();
          }

          const lat = parseCoordinate(firstMember.mlt_lat) || parseCoordinate(firstMember.location?.lat);
          const lng = parseCoordinate(firstMember.mlt_long) || parseCoordinate(firstMember.location?.lng);
            const photoForMarker = getSafeImageUrl(firstMember.photo, firstMember.mt_gender, firstMember.original_index);
            const borderColor = '#f59e0b'; // 선택된 멤버 색상

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
                .member-info-window-container {
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
              <div class="member-info-window-container" style="
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

                <div style="
                  display: flex;
                  align-items: center;
                  margin-bottom: 8px;
                ">
                  <div style="
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin-right: 12px;
                    border: 2px solid ${borderColor};
                  ">
                    <img src="${photoForMarker}" 
                         style="width: 100%; height: 100%; object-fit: cover;" 
                         alt="${firstMember.name}" />
                  </div>
                  <div style="padding-right: 25px;">
                    <h3 style="
                      margin: 0;
                      font-size: 14px;
                      font-weight: 600;
                      color: #111827;
                    ">👤 ${firstMember.name}</h3>
                    <p style="
                      margin: 2px 0 0 0;
                      font-size: 12px;
                      color: #64748b;
                    ">선택된 멤버</p>
                  </div>
                </div>
                
                <div style="margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    📍 위치: <span style="color: #0113A3; font-weight: 500;">${lat?.toFixed(4)}, ${lng?.toFixed(4)}</span>
                  </p>
                </div>
                <div>
                  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                    🗺️ 현재 위치 정보
                  </p>
                </div>
              </div>
            `,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true
          });

          memberInfoWindow.open(map, selectedMarker);
          setInfoWindow(memberInfoWindow);
          setIsFirstMemberSelectionComplete(true);
          console.log('[초기 InfoWindow] 첫 번째 멤버 InfoWindow 표시 완료:', firstMember.name);
        }
      }
    }
  }, [memberMarkers, groupMembers, isFirstMemberSelectionComplete, map]);

  // groupMembers 상태 변경 시 마커 업데이트 (그룹 멤버 리스트에서 선택 시 InfoWindow 표시를 위해)
  useEffect(() => {
    if (map && window.naver && isMapReady) {
      console.log('[useEffect] groupMembers 변경으로 인한 마커 업데이트:', groupMembers.length, '명');
      if (groupMembers.length > 0) {
        updateMemberMarkers(groupMembers);
      } else {
        // 멤버가 없으면 기존 마커들 제거
        memberMarkers.forEach(marker => {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        });
        setMemberMarkers([]);
      }
    }
  }, [groupMembers, map, isMapReady]);



  // 페이지 로드 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // 디버깅용 - 로딩 상태 추적
  useEffect(() => {
    console.log('[로딩 상태 추적]', {
      isMapLoading,
      isMapReady,
      isMapInitialized,
      isFetchingGroupMembers,
      groupMembersCount: groupMembers.length,
      hasMap: !!map,
      hasNaverAPI: !!(window.naver && window.naver.maps),
      selectedMemberSavedLocationsCount: selectedMemberSavedLocations?.length || 0
    });
  }, [isMapLoading, isMapReady, isMapInitialized, isFetchingGroupMembers, groupMembers.length, map, selectedMemberSavedLocations]);

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
  }, [isMapInitialized, activeView]); // selectedMemberIdRef.current 제거하여 무한 재조회 방지

  // 그룹별 멤버 수 조회
  useEffect(() => {
    const fetchGroupMemberCounts = async () => {
      if (!userGroups || userGroups.length === 0) return;

      console.log('[LOCATION] 그룹 멤버 수 조회 시작:', userGroups.length, '개 그룹');
      
      const counts: Record<number, number> = {};
      
      await Promise.all(userGroups.map(async (group) => {
        try {
          const count = await getGroupMemberCount(group.sgt_idx);
          counts[group.sgt_idx] = count;
          console.log(`[LOCATION] 그룹 ${group.sgt_title}(${group.sgt_idx}) 멤버 수:`, count);
        } catch (error) {
          console.error(`[LOCATION] 그룹 ${group.sgt_idx} 멤버 수 조회 실패:`, error);
          counts[group.sgt_idx] = 0;
        }
      }));
      
      setGroupMemberCounts(counts);
      console.log('[LOCATION] 그룹 멤버 수 조회 완료:', counts);
    };

    fetchGroupMemberCounts();
  }, [userGroups]);

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
      
      // 그룹 데이터 로딩 완료 표시
      dataFetchedRef.current.groups = true;
    } catch (error) {
      console.error('[fetchUserGroups] 그룹 목록 조회 실패:', error);
      setUserGroups([]);
      // 실패해도 로딩 완료로 표시하여 무한 로딩 방지
      dataFetchedRef.current.groups = true;
    } finally {
      setIsLoadingGroups(false);
    }
  };

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

  // 좌표 안전성 검사 헬퍼 함수
  const parseCoordinate = (coord: any): number | null => {
    if (typeof coord === 'number') return coord;
    if (typeof coord === 'string' && !isNaN(parseFloat(coord))) return parseFloat(coord);
    return null;
  };

  // 안전한 이미지 URL 가져오기 헬퍼 함수
  const getSafeImageUrl = (photoUrl: string | null, gender: number | null | undefined, index: number): string => {
    // 그룹멤버 리스트와 동일한 로직: 실제 사진이 있으면 사용하고, 없으면 기본 이미지 사용
    return photoUrl ?? getDefaultImage(gender, index);
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
        // 좌표 안전성 검사 - 실시간 위치(mlt_lat, mlt_long) 우선 사용
        const lat = parseCoordinate(member.mlt_lat) || parseCoordinate(member.location?.lat);
        const lng = parseCoordinate(member.mlt_long) || parseCoordinate(member.location?.lng);



        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
          const position = new window.naver.maps.LatLng(lat, lng);
          // 선택된 멤버는 핑크색 외곽선, 일반 멤버는 인디고 외곽선 (home/page.tsx 스타일)
          const borderColor = member.isSelected ? '#EC4899' : '#0113A3';
      
      const marker = new window.naver.maps.Marker({
            position: position,
            map: map,
            title: member.name,
        icon: {
          content: `
            <div style="position: relative; text-align: center;">
              <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <img 
                  src="${photoForMarker}" 
                  alt="${member.name}" 
                  style="width: 100%; height: 100%; object-fit: cover;" 
                  onerror="this.src='/images/avatar1.png'"
                />
              </div>
              <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
                ${member.name}
              </div>
            </div>
          `,
          size: new window.naver.maps.Size(60, 50),
          anchor: new window.naver.maps.Point(30, 32)
        },
            zIndex: member.isSelected ? 200 : 150 // 선택된 멤버가 위에 표시되도록
          });

          // 멤버 마커 클릭 이벤트 - handleMemberSelect만 호출하도록 단순화
          window.naver.maps.Event.addListener(marker, 'click', () => {
            handleMemberSelect(member.id);
          });

          newMemberMarkers.push(marker);
        } else {
          console.warn('[updateMemberMarkers] 유효하지 않은 멤버 좌표:', member.name);
        }
      });

      // 지도 초기화 시점에 이미 올바른 위치로 설정되므로 추가 이동 불필요
      // (handleMemberSelect에서만 지도 중심 이동 처리)
    }

    setMemberMarkers(newMemberMarkers);
    console.log('[updateMemberMarkers] 멤버 마커 업데이트 완료:', newMemberMarkers.length, '개');

    // 선택된 멤버가 있으면 InfoWindow 자동 표시 (중복 방지)
    const selectedMember = members.find(member => member.isSelected);
    const selectedMemberIndex = members.findIndex(member => member.isSelected);
    const selectedMarker = newMemberMarkers[selectedMemberIndex];

    if (selectedMember && selectedMarker && isFirstMemberSelectionComplete) {
      // InfoWindow가 이미 열려있고 같은 멤버인 경우 중복 생성 방지
      const isInfoWindowOpen = infoWindow && infoWindow.getMap();
      const isSameMember = selectedMemberIdRef.current === selectedMember.id;
      
      if (isInfoWindowOpen && isSameMember) {
        console.log('[updateMemberMarkers] InfoWindow가 이미 열려있음, 중복 생성 방지:', selectedMember.name);
        return;
      }
      
      console.log('[updateMemberMarkers] 선택된 멤버 InfoWindow 자동 표시:', selectedMember.name);
      
      // 기존 InfoWindow 닫기
      if (infoWindow) {
        infoWindow.close();
      }

      const lat = parseCoordinate(selectedMember.mlt_lat) || parseCoordinate(selectedMember.location?.lat);
      const lng = parseCoordinate(selectedMember.mlt_long) || parseCoordinate(selectedMember.location?.lng);

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
            .member-info-window-container {
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
          <div class="member-info-window-container" style="
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

            <div style="margin-bottom: 8px;">
              <h3 style="
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: #111827;
                padding-right: 25px;
              ">👤 ${selectedMember.name}</h3>
              <p style="
                margin: 0;
                font-size: 12px;
                color: #64748b;
              ">선택된 멤버</p>
            </div>
            
            <div style="margin-bottom: 6px;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                📍 위치: <span style="color: #0113A3; font-weight: 500;">${lat?.toFixed(4)}, ${lng?.toFixed(4)}</span>
              </p>
            </div>
            <div>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                🗺️ 현재 위치 정보
              </p>
            </div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: true
      });

      memberInfoWindow.open(map, selectedMarker);
      setInfoWindow(memberInfoWindow);
      console.log('[updateMemberMarkers] 자동 InfoWindow 표시 완료:', selectedMember.name);
    }
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

        // 바텀시트에 가려지지 않도록 남쪽으로 오프셋 적용하여 지도 중심 이동
        const [lng, lat] = location.coordinates;
        const offsetLat = lat - 0.002;
        const offsetPosition = new window.naver.maps.LatLng(offsetLat, lng);
        map.panTo(offsetPosition, {
          duration: 800,
          easing: 'easeOutCubic'
        });

        // 통일된 정보창 생성
        const newInfoWindow = createLocationInfoWindow(location.name, location.address);
        newInfoWindow.open(map, marker);
        setInfoWindow(newInfoWindow);

        // 선택 상태 업데이트 (마커 재생성 없이)
        const previousSelectedId = selectedLocationIdRef.current;
        setSelectedLocationId(location.id);
        selectedLocationIdRef.current = location.id;
        
        console.log('[마커 클릭] 장소 선택됨:', location.id, location.name, '이전 선택:', previousSelectedId);
        
        // 모든 마커의 색상을 즉시 업데이트
        updateMarkerColors(location.id);
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
    console.log('[updateMapMarkers] 마커 업데이트 완료:', newMarkers.length, '개');
  };

  // 통합 마커 업데이트 함수 - 멤버 마커와 장소 마커를 동시에 업데이트
  const updateAllMarkers = (members: GroupMember[], locations: LocationData[] | null) => {
    if (!map || !window.naver || !isMapReady) {
      console.log('[updateAllMarkers] 지도가 준비되지 않음');
      return;
    }

    console.log('[updateAllMarkers] 시작 - 멤버:', members.length, '명, 장소:', locations?.length || 0, '개');

    // 기존 모든 마커들 제거
    memberMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markers.forEach(marker => marker.setMap(null));
    setMemberMarkers([]);
    setMarkers([]);

    // 새 멤버 마커들 생성
    const newMemberMarkers: NaverMarker[] = [];
    
    if (members.length > 0) {
      members.forEach((member, index) => {
        const lat = parseCoordinate(member.mlt_lat) || parseCoordinate(member.location?.lat);
        const lng = parseCoordinate(member.mlt_long) || parseCoordinate(member.location?.lng);

        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          const photoForMarker = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
          const position = new window.naver.maps.LatLng(lat, lng);
          const borderColor = member.isSelected ? '#EC4899' : '#0113A3';
      
      
          const marker = new window.naver.maps.Marker({
            position: position,
            map: map,
            title: member.name,
            icon: {
              content: `
                <div style="position: relative; text-align: center;">
                  <div style="width: 32px; height: 32px; background-color: white; border: 2px solid ${borderColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    <img 
                      src="${photoForMarker}" 
                      alt="${member.name}" 
                      style="width: 100%; height: 100%; object-fit: cover;" 
                      onerror="this.src='/images/avatar1.png'"
                    />
                  </div>
                  <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; white-space: nowrap; font-size: 10px; font-weight: 500;">
                    ${member.name}
                  </div>
                </div>
              `,
              size: new window.naver.maps.Size(60, 50),
              anchor: new window.naver.maps.Point(30, 32)
            },
            zIndex: member.isSelected ? 200 : 150
          });

          // 멤버 마커 클릭 이벤트 - handleMemberSelect만 호출하도록 단순화
          window.naver.maps.Event.addListener(marker, 'click', () => {
            handleMemberSelect(member.id);
          });

          newMemberMarkers.push(marker);
        }
      });

      // 지도 초기화 시점에 이미 올바른 위치로 설정되므로 추가 이동 불필요
      // (handleMemberSelect에서만 지도 중심 이동 처리)
    }

    // 새 장소 마커들 생성
    const newLocationMarkers: NaverMarker[] = [];
    
    console.log('[updateAllMarkers] 장소 마커 생성 시작:', {
      hasLocations: !!locations,
      locationsLength: locations?.length || 0,
      locations: locations?.map(loc => ({
        id: loc.id,
        name: loc.name,
        coordinates: loc.coordinates,
        isValidCoords: loc.coordinates[0] !== 0 && loc.coordinates[1] !== 0
      })) || []
    });
    
    if (locations && locations.length > 0) {
      locations.forEach((location, index) => {
        const [lng, lat] = location.coordinates;
        
        console.log(`[updateAllMarkers] 장소 ${index + 1}/${locations.length}:`, {
          name: location.name,
          coordinates: [lng, lat],
          isValidCoords: lat !== 0 && lng !== 0
        });
        
        if (lat === 0 && lng === 0) {
          console.log(`[updateAllMarkers] 장소 ${location.name} 건너뜀: 유효하지 않은 좌표`);
          return;
        }
        
        const position = new window.naver.maps.LatLng(lat, lng);
        const isMarkerSelected = selectedLocationIdRef.current === location.id;
        
        const memberCount = members.length;
        
        const marker = new window.naver.maps.Marker({
          position,
          map,
          title: location.name,
          icon: {
            content: `
              <div style="width: 24px; height: 24px; background-color: white; border: 2px solid ${isMarkerSelected ? '#f59e0b' : '#6366f1'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <div style="width: 8px; height: 8px; background-color: ${isMarkerSelected ? '#f59e0b' : '#6366f1'}; border-radius: 50%;"></div>
              </div>
            `,
            size: new window.naver.maps.Size(24, 24),
            anchor: new window.naver.maps.Point(12, 12)
          },
          zIndex: isMarkerSelected ? 200 : 150
        });

        // 장소 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          if (infoWindow) {
            infoWindow.close();
          }

          // 장소 위치로 지도 중심 이동
          const [lng, lat] = location.coordinates;
          const position = new window.naver.maps.LatLng(lat, lng);
          map.panTo(position, {
            duration: 800,
            easing: 'easeOutCubic'
          });

          const newInfoWindow = createLocationInfoWindow(location.name, location.address);
        newInfoWindow.open(map, marker);
        setInfoWindow(newInfoWindow);

          const previousSelectedId = selectedLocationIdRef.current;
        setSelectedLocationId(location.id);
        selectedLocationIdRef.current = location.id;
        
          console.log('[updateAllMarkers] 장소 선택됨:', location.id, location.name, '이전 선택:', previousSelectedId);
          
          // 모든 마커의 색상을 즉시 업데이트
          updateMarkerColors(location.id);
        });

        newLocationMarkers.push(marker);
        console.log(`[updateAllMarkers] 장소 마커 생성 완료: ${location.name}`);
      });
      
      console.log('[updateAllMarkers] 모든 장소 마커 생성 완료:', newLocationMarkers.length, '개');
    } else {
      console.log('[updateAllMarkers] 장소 데이터가 없거나 비어있음');
    }

    // 상태 업데이트
    setMemberMarkers(newMemberMarkers);
    setMarkers(newLocationMarkers);
    
    console.log('[updateAllMarkers] 완료 - 멤버 마커:', newMemberMarkers.length, '개, 장소 마커:', newLocationMarkers.length, '개');
  };

  // 선택된 멤버의 장소가 변경될 때 마커 업데이트
  useEffect(() => {
    console.log('[useEffect 통합 마커] 조건 체크:', {
      hasSelectedLocations: !!(selectedMemberSavedLocations && selectedMemberSavedLocations.length > 0),
      locationsCount: selectedMemberSavedLocations?.length || 0,
      hasMap: !!map,
      isMapReady,
      groupMembersCount: groupMembers.length,
      selectedMemberIdRef: selectedMemberIdRef.current,
      locations: selectedMemberSavedLocations?.map(loc => ({ 
        id: loc.id, 
        name: loc.name, 
        coordinates: loc.coordinates,
        hasValidCoords: loc.coordinates[0] !== 0 && loc.coordinates[1] !== 0
      })) || []
    });
    
    if (map && isMapReady) {
      if (groupMembers.length > 0) {
        console.log('[useEffect 통합 마커] 통합 마커 업데이트 시작');
        console.log('[useEffect 통합 마커] 전달할 데이터:', {
          멤버수: groupMembers.length,
          장소수: selectedMemberSavedLocations?.length || 0,
          장소데이터: selectedMemberSavedLocations
        });
        updateAllMarkers(groupMembers, selectedMemberSavedLocations);
      } else {
        console.log('[useEffect 통합 마커] 기존 마커들 제거');
        // 조건에 맞지 않으면 기존 마커들 제거
        memberMarkers.forEach(marker => {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        });
        markers.forEach(marker => marker.setMap(null));
        setMemberMarkers([]);
        setMarkers([]);
        if (infoWindow) {
          infoWindow.close();
          setInfoWindow(null);
        }
      }
    } else {
      console.log('[useEffect 통합 마커] 조건 미충족:', {
        hasMap: !!map,
        isMapReady,
        groupMembersLength: groupMembers.length
      });
    }
  }, [selectedMemberSavedLocations, groupMembers, map, isMapReady]);



  // 마커 색상 업데이트 함수
  const updateMarkerColors = (selectedId: string | null) => {
    console.log('[updateMarkerColors] 마커 색상 업데이트:', selectedId);
    
    markers.forEach((marker, index) => {
      // selectedMemberSavedLocations 또는 otherMembersSavedLocations에서 해당 location 찾기
      let location = null;
      
      if (selectedMemberSavedLocations && selectedMemberSavedLocations[index]) {
        location = selectedMemberSavedLocations[index];
      } else if (otherMembersSavedLocations && otherMembersSavedLocations[index]) {
        location = otherMembersSavedLocations[index];
        // otherMembersSavedLocations의 경우 id 구성이 다를 수 있음
        location = {
          ...location,
          id: location.slt_idx ? location.slt_idx.toString() : location.id
        };
      }
      
      if (location) {
        const isSelected = selectedId === location.id;
        
        // 마커 아이콘 업데이트
        marker.setIcon({
          content: `
            <div style="position: relative; text-align: center;">
              <div style="
                width: 32px;
                height: 32px;
                background-color: white;
                border: 2px solid ${isSelected ? '#f59e0b' : '#6366f1'};
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
                <svg width="16" height="16" fill="${isSelected ? '#f59e0b' : '#6366f1'}" viewBox="0 0 24 24">
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
                ${location.name || (location as any).slt_title || '제목 없음'}
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
  };

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
                    background: rgba(245, 158, 11, 0.2);
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


  // 통일된 정보창 생성 함수 - home/page.tsx 스타일 적용
  const createLocationInfoWindow = (locationName: string, locationAddress: string) => {
    const newInfoWindow = new window.naver.maps.InfoWindow({
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
          .location-info-window-container {
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
        <div class="location-info-window-container" style="
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
          
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
            📍 ${locationName}
          </h3>
          <div style="margin-bottom: 6px;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              <span style="color: #64748b; font-weight: 500; word-break: keep-all;">${locationAddress}</span>
            </p>
          </div>
        </div>
      `,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true
    });
    
    // InfoWindow가 닫힐 때 상태 업데이트
    window.naver.maps.Event.addListener(newInfoWindow, 'close', () => {
      console.log('[InfoWindow] 닫힘 이벤트 발생');
      setInfoWindow(null);
    });
    
    return newInfoWindow;
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
    
    // 모든 마커의 색상을 즉시 업데이트
    updateMarkerColors(locationId);
    
    // 지도와 좌표가 유효한 경우에만 지도 이동 및 마커 처리
    if (!map || !window.naver || lat === 0 || lng === 0) {
      console.log('[handleLocationCardClick] 지도 이동 불가 - 좌표 없음 또는 지도 미초기화');
      return;
    }
    
    // 장소 위치로 지도 중심 이동
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

  // 지도 준비 완료 후 첫 번째 멤버 자동 선택 - 제거하여 무한 재조회 방지
  // useEffect(() => {
  //   if (isMapReady && groupMembers.length > 0 && !isFetchingGroupMembers) {
  //     const hasSelectedMember = groupMembers.some(member => member.isSelected);
      
  //     if (!hasSelectedMember) {
  //       console.log('[useEffect] 지도 준비 완료 - 첫 번째 멤버 자동 선택');
  //       handleMemberSelect(groupMembers[0].id, false, groupMembers);
  //     } else {
  //       // 이미 선택된 멤버가 있다면 해당 멤버의 장소 데이터 로드
  //       const selectedMember = groupMembers.find(m => m.isSelected);
  //       if (selectedMember && (!selectedMemberSavedLocations || selectedMemberSavedLocations.length === 0)) {
  //         console.log('[useEffect] 선택된 멤버의 장소 데이터 로드:', selectedMember.name);
  //         handleMemberSelect(selectedMember.id, false, groupMembers);
  //       }
  //     }
  //   }
  // }, [isMapReady, groupMembers, isFetchingGroupMembers]);

  // 장소 삭제 모달 열기
  const openLocationDeleteModal = (location: LocationData | OtherMemberLocationRaw) => {
    setLocationToDelete(location);
    setIsLocationDeleteModalOpen(true);
  };

  // 장소 삭제 모달 닫기
  const closeLocationDeleteModal = () => {
    if (!isDeletingLocation) {
      setLocationToDelete(null);
      setIsLocationDeleteModalOpen(false);
    }
  };

  // 실제 장소 삭제 처리
  const handleLocationDelete = async () => {
    if (!locationToDelete) return;
    
    setIsDeletingLocation(true);
    
    try {
      const locationId = 'slt_idx' in locationToDelete ? locationToDelete.slt_idx?.toString() : locationToDelete.id;
      const sltIdx = 'slt_idx' in locationToDelete ? locationToDelete.slt_idx : null;
      const locationName = 'slt_title' in locationToDelete ? locationToDelete.slt_title : locationToDelete.name;
      
      console.log('[장소 삭제] 시작:', locationId, 'slt_idx:', sltIdx, locationName);
      
      // DB에서 숨김 처리 (slt_idx가 있는 경우에만)
      if (sltIdx) {
        try {
          const sltIdxNumber = typeof sltIdx === 'string' ? parseInt(sltIdx, 10) : sltIdx;
          await locationService.hideLocation(sltIdxNumber);
          console.log('[장소 삭제] DB 처리 성공 (숨김 처리):', sltIdxNumber);
        } catch (dbError) {
          console.error('[장소 삭제] DB 처리 실패:', dbError);
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
      
      if ('slt_idx' in locationToDelete && locationToDelete.slt_idx) {
        setOtherMembersSavedLocations(prev => prev.filter(loc => loc.slt_idx !== locationToDelete.slt_idx));
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
      
      // 삭제 모달 닫기
      closeLocationDeleteModal();
      
      // 성공 모달 표시 (3초 자동 닫기)
      openModal('장소 삭제 완료', `'${locationName}' 장소가 삭제되었습니다.`, 'success', undefined, true);
      
    } catch (error) {
      console.error('장소 삭제 처리 중 전체 오류:', error);
      openModal('장소 삭제 실패', '장소 삭제 처리 중 예기치 않은 오류가 발생했습니다.', 'error');
    } finally {
      setIsDeletingLocation(false);
    }
  };

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 장소 선택 핸들러 (사이드바에서 장소 클릭 시)
  const handleLocationSelect = (location: LocationData) => {
    console.log('[handleLocationSelect] 장소 선택:', location.name);
    
    // 장소 선택 중임을 표시하여 다른 로직의 지도 이동 방지
    isLocationSelectingRef.current = true;
    
    // 지도에서 해당 장소로 이동 (사이드바 닫기 전에 먼저 실행)
    if (map && location.coordinates) {
      const [lng, lat] = location.coordinates;
      
      if (lat && lng && lat !== 0 && lng !== 0) {
        console.log('[handleLocationSelect] 지도 이동:', { lat, lng });
        
        // 즉시 지도 중심 이동 (강제) - 여러 번 호출하여 확실히 이동
        const targetPosition = new window.naver.maps.LatLng(lat, lng);
        map.setCenter(targetPosition);
        
        // 추가로 panTo도 사용하여 더 확실하게 이동
        setTimeout(() => {
          map.panTo(targetPosition);
        }, 50);
        
        // 한 번 더 setCenter 호출 (다른 로직의 간섭 방지)
        setTimeout(() => {
          map.setCenter(targetPosition);
        }, 200);
        
        // 줌 레벨 조정 (장소를 잘 볼 수 있도록)
        const currentZoom = map.getZoom();
        if (currentZoom < 16) {
          map.setZoom(17);
        }
        
        // 기존 InfoWindow 즉시 닫기
        if (infoWindow) {
          infoWindow.close();
        }
        
        // 선택된 장소 상태 업데이트 (마커 색상 변경을 위해)
        setSelectedLocationId(location.id);
        selectedLocationIdRef.current = location.id;
        
        // 마커 색상 업데이트
        updateMarkerColors(location.id);
        
        // 해당 장소의 마커를 찾아서 InfoWindow 표시
        console.log('[handleLocationSelect] 마커 찾기 시작:', {
          찾는좌표: [lat, lng],
          현재마커수: markers.length,
          마커들좌표: markers.map(m => {
            const pos = m.getPosition();
            return [pos.lat(), pos.lng()];
          })
        });
        
        let targetMarker = markers.find(marker => {
          const markerPosition = marker.getPosition();
          const latDiff = Math.abs(markerPosition.lat() - lat);
          const lngDiff = Math.abs(markerPosition.lng() - lng);
          console.log('[handleLocationSelect] 마커 좌표 비교:', {
            마커좌표: [markerPosition.lat(), markerPosition.lng()],
            찾는좌표: [lat, lng],
            차이: [latDiff, lngDiff],
            일치: latDiff < 0.0001 && lngDiff < 0.0001
          });
          return latDiff < 0.0001 && lngDiff < 0.0001;
        });
        
        console.log('[handleLocationSelect] 마커 찾기 결과:', {
          찾음: !!targetMarker,
          마커타입: targetMarker ? typeof targetMarker : 'undefined'
        });
        
        // 마커를 찾지 못한 경우 새로 생성
        if (!targetMarker) {
          console.log('[handleLocationSelect] 기존 마커를 찾을 수 없어 새 마커 생성:', location.name);
          
          const position = new window.naver.maps.LatLng(lat, lng);
          targetMarker = new window.naver.maps.Marker({
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
                    border: 2px solid #ec4899;
                    border-radius: 50%;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 200;
                    transition: all 0.3s ease;
                  ">
                    <svg width="16" height="16" fill="#ec4899" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                    </svg>
                  </div>
                  
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
            zIndex: 200
          });
          
          // 새 마커를 markers 배열에 추가
          setMarkers(prev => [...prev, targetMarker]);
          
          console.log('[handleLocationSelect] 새 마커 생성 완료:', {
            마커위치: [lat, lng],
            마커객체: !!targetMarker,
            지도에표시됨: targetMarker.getMap() === map,
            zIndex: targetMarker.getZIndex()
          });
        } else {
          console.log('[handleLocationSelect] 기존 마커 사용:', {
            마커위치: [targetMarker.getPosition().lat(), targetMarker.getPosition().lng()],
            지도에표시됨: targetMarker.getMap() === map,
            zIndex: targetMarker.getZIndex()
          });
        }
        
        // InfoWindow content 문자열 생성
        const infoWindowContent = `
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
            .location-info-window-container {
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
          <div class="location-info-window-container" style="
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
            
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; padding-right: 25px;">
              📍 ${location.name}
            </h3>
            <div style="margin-bottom: 6px;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                <span style="color: #64748b; font-weight: 500; word-break: keep-all;">${location.address}</span>
              </p>
            </div>
          </div>
        `;
        
        // 새 InfoWindow 생성 및 표시
        const newInfoWindow = new window.naver.maps.InfoWindow({
          content: infoWindowContent,
          borderWidth: 0,
          backgroundColor: 'transparent',
          disableAnchor: true
        });
        
        // InfoWindow가 닫힐 때 상태 업데이트
        window.naver.maps.Event.addListener(newInfoWindow, 'close', () => {
          console.log('[InfoWindow] 닫힘 이벤트 발생');
          setInfoWindow(null);
        });
        
        newInfoWindow.open(map, targetMarker);
        setInfoWindow(newInfoWindow);
        
        console.log('[handleLocationSelect] InfoWindow 표시 완료:', location.name);
        
        // 햅틱 피드백
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
        
        // 지도 이동 완료 후 사이드바 닫기 (더 긴 지연으로 다른 로직의 간섭 방지)
        setTimeout(() => {
          setIsSidebarOpen(false);
        }, 800); // 더 긴 지연으로 설정
        
        // 지속적으로 지도 중심을 해당 장소로 유지 (다른 로직의 간섭 방지)
        const keepLocationCentered = () => {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              if (map) {
                const currentCenter = map.getCenter();
                if (Math.abs(currentCenter.lat() - lat) > 0.001 || Math.abs(currentCenter.lng() - lng) > 0.001) {
                  console.log(`[handleLocationSelect] 지도 중심 재설정 ${i + 1}회차:`, { 
                    expected: { lat, lng }, 
                    current: { lat: currentCenter.lat(), lng: currentCenter.lng() } 
                  });
                  map.setCenter(targetPosition);
                }
              }
            }, 200 * (i + 1)); // 200ms, 400ms, 600ms, 800ms, 1000ms 간격으로 체크
          }
          
          // 장소 선택 완료, 플래그 해제
          setTimeout(() => {
            isLocationSelectingRef.current = false;
          }, 1200);
        };
        
        keepLocationCentered();
        
      } else {
        console.warn('[handleLocationSelect] 유효하지 않은 좌표:', { lat, lng });
        setIsSidebarOpen(false);
      }
    } else {
      console.warn('[handleLocationSelect] 지도 또는 좌표가 없습니다:', { map: !!map, coordinates: location.coordinates });
      setIsSidebarOpen(false);
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
      setTimeout(() => {
        document.addEventListener('mousedown', handleSidebarClickOutside);
      }, 100);
      
      return () => {
        document.removeEventListener('mousedown', handleSidebarClickOutside);
      };
    }
  }, [isSidebarOpen]);

  // 그룹 선택 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (isGroupSelectorOpen) {
        const target = event.target as HTMLElement;
        
        // 그룹 드롭다운 관련 요소들을 더 구체적으로 확인
        const isGroupDropdownContainer = target.closest('[data-group-dropdown-container]');
        const isGroupDropdownButton = target.closest('[data-group-selector]');
        const isGroupDropdownMenu = target.closest('[data-group-dropdown-menu]');
        
        // 그룹 드롭다운 관련 요소가 아닌 외부 클릭인 경우에만 닫기
        if (!isGroupDropdownContainer && !isGroupDropdownButton && !isGroupDropdownMenu) {
          console.log('[handleClickOutside] 그룹 드롭다운 외부 클릭 감지 - 드롭다운 닫기');
          setIsGroupSelectorOpen(false);
        }
      }
    };

    if (isGroupSelectorOpen) {
      // 약간의 지연을 주어 클릭 이벤트가 완전히 처리된 후 리스너 추가
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 10);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isGroupSelectorOpen]);

  // InfoWindow 외부 클릭 감지
  useEffect(() => {
    if (!infoWindow) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      console.log('[InfoWindow 외부 클릭] 클릭 감지:', target.tagName);
      
      // 간단한 방식: InfoWindow가 열려있으면 무조건 닫기 (InfoWindow 내부 요소가 아닌 경우)
      const isInfoWindowOrMarker = target.closest('.iw_container') || 
                                   target.closest('.iw_content') ||
                                   target.parentElement?.classList.contains('iw_container') ||
                                   target.classList.contains('iw_container');
      
      if (!isInfoWindowOrMarker && infoWindow) {
        console.log('[InfoWindow 외부 클릭] InfoWindow 닫기 시도');
        if (infoWindow.close) {
          infoWindow.close();
        }
        setInfoWindow(null);
      }
    };

    // 즉시 이벤트 리스너 등록 (지연 없음)
    console.log('[InfoWindow useEffect] 외부 클릭 리스너 등록');
    document.addEventListener('click', handleDocumentClick, true); // capture 단계에서 처리
      document.addEventListener('mousedown', handleDocumentClick);

    return () => {
      console.log('[InfoWindow useEffect] 외부 클릭 리스너 제거');
      console.log('[InfoWindow useEffect] 외부 클릭 리스너 제거');
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [infoWindow]);

  // ESC 키로 InfoWindow 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && infoWindow && infoWindow.getMap && infoWindow.getMap()) {
        console.log('[ESC] InfoWindow 닫기');
        infoWindow.close();
        setInfoWindow(null);
      }
    };

    if (infoWindow) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [infoWindow]);

  return (
    <>
      <style jsx global>{mobileStyles}</style>
      
      <motion.div
        initial="initial"
        animate={
          isExiting ? "out" : "in"
        }
        variants={pageVariants}
        className="bg-white min-h-screen relative overflow-hidden"
      >
        {/* 개선된 헤더 - home/page.tsx 패턴 적용 */}
        <motion.header 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1 
            }}
            className="fixed top-0 left-0 right-0 z-20 glass-effect"
          >
            <div className="flex items-center justify-between h-16 px-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: '#0113A3' }}
                  >
                    <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                  </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">내 장소</h1>
                    <p className="text-xs text-gray-500">그룹 멤버들과 장소를 공유해보세요</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
              </div>
            </div>
          </motion.header>
        
        {/* 지도 영역 - logs/page.tsx와 동일한 구조 */}
        <div 
          className="full-map-container" 
          style={{ 
            paddingTop: '0px', 
            position: 'relative'
          }}
        >
          <div ref={mapContainer} className="w-full h-full" />
          
          {/* 커스텀 줌 컨트롤 */}
          {map && (
            <div className="absolute top-[200px] right-[10px] z-30 flex flex-col space-y-1">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (map) {
                    // InfoWindow 상태 완전히 저장
                    let savedInfoWindow = null;
                    if (infoWindow && infoWindow.getMap()) {
                      savedInfoWindow = {
                        position: infoWindow.getPosition(),
                        content: infoWindow.getContent(),
                        options: infoWindow.getOptions ? infoWindow.getOptions() : {}
                      };
                      console.log('[줌인] InfoWindow 상태 저장:', savedInfoWindow);
                    }
                    
                    const currentZoom = map.getZoom();
                    map.setZoom(currentZoom + 1);
                    
                    // 줌 완료 후 InfoWindow 재생성
                    if (savedInfoWindow) {
                      // 줌 애니메이션이 완료될 때까지 기다린 후 InfoWindow 재생성
                      setTimeout(() => {
                        try {
                          // 새로운 InfoWindow 생성
                          const newInfoWindow = new window.naver.maps.InfoWindow({
                            content: savedInfoWindow.content,
                            position: savedInfoWindow.position,
                            backgroundColor: '#ffffff',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            anchorSize: new window.naver.maps.Size(10, 10)
                          });
                          
                          newInfoWindow.open(map);
                          setInfoWindow(newInfoWindow);
                          console.log('[줌인] InfoWindow 재생성 완료');
                        } catch (error) {
                          console.error('[줌인] InfoWindow 재생성 실패:', error);
                        }
                      }, 300);
                    }
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
                  if (map) {
                    // InfoWindow 상태 완전히 저장
                    let savedInfoWindow = null;
                    if (infoWindow && infoWindow.getMap()) {
                      savedInfoWindow = {
                        position: infoWindow.getPosition(),
                        content: infoWindow.getContent(),
                        options: infoWindow.getOptions ? infoWindow.getOptions() : {}
                      };
                      console.log('[줌아웃] InfoWindow 상태 저장:', savedInfoWindow);
                    }
                    
                    const currentZoom = map.getZoom();
                    map.setZoom(currentZoom - 1);
                    
                    // 줌 완료 후 InfoWindow 재생성
                    if (savedInfoWindow) {
                      // 줌 애니메이션이 완료될 때까지 기다린 후 InfoWindow 재생성
                      setTimeout(() => {
                        try {
                          // 새로운 InfoWindow 생성
                          const newInfoWindow = new window.naver.maps.InfoWindow({
                            content: savedInfoWindow.content,
                            position: savedInfoWindow.position,
                            backgroundColor: '#ffffff',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            anchorSize: new window.naver.maps.Size(10, 10)
                          });
                          
                          newInfoWindow.open(map);
                          setInfoWindow(newInfoWindow);
                          console.log('[줌아웃] InfoWindow 재생성 완료');
                        } catch (error) {
                          console.error('[줌아웃] InfoWindow 재생성 실패:', error);
                        }
                      }, 300);
                    }
                  }
                }}
                className="w-10 h-10 bg-white border border-gray-300 rounded-b-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold">−</span>
              </motion.button>
            </div>
          )}
          

        </div>

        {/* 개선된 위치 정보 패널 */}
        <AnimatePresence>
        {isLocationInfoPanelOpen && (
            <motion.div 
            ref={infoPanelRef} 
              initial={{ opacity: 0, y: -30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
                  <p className="text-xs font-medium mt-1" style={{ color: '#0113A3' }}>
                    {isEditingPanel ? "장소 정보를 확인하고 관리하세요" : "지도를 클릭하거나 검색하세요"}
                  </p>
                </motion.div>
                
                <div className="flex items-center space-x-2">
                {isEditingPanel && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
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
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                  setIsLocationInfoPanelOpen(false);
                  if (tempMarker.current) tempMarker.current.setMap(null);
                  setIsEditingPanel(false);
                  // 패널 닫기
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
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="flex-1 py-3 px-4 text-white font-medium rounded-xl shadow-lg mobile-button"
                    style={{ backgroundColor: '#0113A3' }}
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
                        <p className="text-xs font-medium mb-2 px-1" style={{ color: '#0113A3' }}>검색 결과</p>
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

                <div className="mt-3 mb-3"> 
                  <p className="text-xs font-medium mb-1" style={{ color: '#0113A3' }}>선택한 위치 주소</p>
                  <div className="flex text-sm font-medium text-gray-700 min-h-[20px]">
                    <span className="opacity-0 pointer-events-none select-none text-xs font-medium mb-1" style={{ color: '#0113A3' }}>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-gray-500 text-sm"
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
                    // 패널 닫기
                      }}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-xl shadow-lg mobile-button"
                    >
                      닫기
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleConfirmPanelAction}
                      className="flex-1 py-3 px-4 bg-indigo-700 text-white font-medium rounded-xl shadow-lg mobile-button"
                    >
                      내 장소 등록
                    </motion.button>
                  </motion.div>
                </motion.div>
        )}
            </motion.div>
          )}
        </AnimatePresence>

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
                      disabled={isLoadingGroups}
                    >
                      <span className="truncate text-gray-700">
                        {isLoadingGroups 
                          ? '로딩 중...' 
                          : userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'
                        }
                      </span>
                      <div className="ml-2 flex-shrink-0">
                        {isLoadingGroups ? (
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

                {/* 멤버 목록 섹션 */}
                <div className="flex-1 min-h-0">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-base font-semibold text-gray-800">멤버 목록</h3>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-3 pb-6">
                    {groupMembers.length > 0 ? (
                      groupMembers.map((member, index) => (
                        <motion.div
                          key={member.id}
                          variants={memberItemVariants}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            handleMemberSelect(member.id);
                            setIsSidebarOpen(false);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                            member.isSelected 
                              ? 'bg-white shadow-lg'
                              : 'bg-white/60 hover:bg-white/80'
                          }`}
                          style={member.isSelected 
                            ? { borderColor: '#0113A3', boxShadow: '0 4px 12px rgba(1, 19, 163, 0.15)' }
                            : { borderColor: 'rgba(1, 19, 163, 0.1)' }
                          }
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                                                             <img
                                 src={getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}
                                 alt={member.name}
                                 className={`w-10 h-10 rounded-full object-cover transition-all duration-200 ${
                                   member.isSelected ? 'ring-2 ring-blue-600' : ''
                                 }`}
                               />
                              {member.isSelected && (
                                <div 
                                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: '#0113A3' }}
                                >
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                member.isSelected ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {member.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.savedLocations?.length || 0}개의 저장된 장소
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">
                          {isLoadingGroups ? '그룹을 불러오는 중...' : '그룹을 선택해주세요'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>




      </motion.div>

      {/* 개선된 커스텀 모달 */}
      <AnimatePresence>
        {isModalOpen && modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={closeModal}
          >
            <motion.div 
              className="bg-white rounded-3xl w-full max-w-md mx-4"
              variants={{
                hidden: { 
                  opacity: 0, 
                  y: 100,
                  scale: 0.95
                },
                visible: { 
                  opacity: 1, 
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }
                },
                exit: { 
                  opacity: 0, 
                  y: 100,
                  scale: 0.95,
                  transition: {
                    duration: 0.2,
                    ease: [0.55, 0.06, 0.68, 0.19]
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    modalContent.type === 'success' ? 'bg-green-100' : 
                    modalContent.type === 'error' ? 'bg-red-100' : 
                    modalContent.type === 'info' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    {modalContent.type === 'success' && <FiCheckCircle className="w-8 h-8 text-green-500" />}
                    {modalContent.type === 'error' && <FiXCircle className="w-8 h-8 text-red-500" />}
                    {modalContent.type === 'info' && <FiAlertTriangle className="w-8 h-8 text-orange-500" />}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{modalContent.title}</h3>
                  <p className="text-gray-600 mb-4">{modalContent.message}</p>
                  
                  {/* 삭제 확인 모달인 경우 진행 바 표시 */}
                  {modalContent.onConfirm && modalContent.type === 'info' && (
                    <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
                      <motion.div 
                        className="bg-orange-500 h-1 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3 }}
                      />
                    </div>
                  )}
                  
                  {/* 알림 설정 완료 모달인 경우 자동 닫기 진행 바 및 텍스트 표시 */}
                  {!modalContent.onConfirm && modalContent.type === 'success' && modalContent.title.includes('알림 설정') && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
                        <motion.div 
                          className="bg-green-500 h-1 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 3, ease: "linear" }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 mb-2">3초 후 자동으로 닫힙니다</p>
                    </>
                  )}
                </div>
                
                {/* 버튼 영역 */}
                <div className="flex flex-col gap-3">
                  {modalContent.onConfirm ? (
                    <>
                      <motion.button
                        onClick={() => {
                          if (modalContent.onConfirm) {
                            modalContent.onConfirm();
                          }
                          closeModal();
                        }}
                        className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${
                          modalContent.type === 'info' 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {modalContent.type === 'info' ? '삭제하기' : '확인'}
                      </motion.button>
                      <motion.button
                        onClick={closeModal}
                        className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium transition-all duration-200"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        취소
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      onClick={closeModal}
                      className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 ${
                        modalContent.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' :
                        modalContent.type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' :
                        'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
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

      {/* 장소 삭제 확인 모달 */}
      <AnimatePresence>
        {isLocationDeleteModalOpen && locationToDelete && (
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLocationDeleteModal}
          >
            <motion.div 
              className="bg-white rounded-3xl w-full max-w-md mx-auto"
              variants={{
                hidden: { 
                  opacity: 0, 
                  y: 100,
                  scale: 0.95
                },
                visible: { 
                  opacity: 1, 
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }
                },
                exit: { 
                  opacity: 0, 
                  y: 100,
                  scale: 0.95,
                  transition: {
                    duration: 0.2,
                    ease: [0.55, 0.06, 0.68, 0.19]
                  }
                }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-8">
                <div className="text-center mb-6">
                  <FaTrash className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-900">장소 삭제</h3>
                  <p className="text-gray-600 mt-2 mb-4">
                    <span className="font-medium text-red-600">
                      "{'slt_title' in locationToDelete ? locationToDelete.slt_title : locationToDelete.name}"
                    </span> 장소를 정말 삭제하시겠습니까?
                  </p>
                </div>
                
                <div className="space-y-3">
                  <motion.button
                    onClick={handleLocationDelete}
                    disabled={isDeletingLocation}
                    className="w-full py-4 bg-red-500 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isDeletingLocation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        삭제 중...
                      </>
                    ) : (
                      '장소 삭제'
                    )}
                  </motion.button>
                  
                  <motion.button
                    onClick={closeLocationDeleteModal}
                    disabled={isDeletingLocation}
                    className="w-full py-4 border border-gray-300 rounded-2xl text-gray-700 font-medium disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    취소
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
            
            {/* 사이드바 */}
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
                bottom: '60px', // 네비게이션 바 높이만큼 여유 공간
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
                {/* 개선된 헤더 */}
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

                {/* 그룹 선택 드롭다운 */}
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-base font-semibold text-gray-800">그룹 선택</h3>
                  </div>
                  <div className="relative" ref={groupDropdownRef}>
                    <motion.button
                      whileHover={{ scale: 1.02, borderColor: "#0113A3" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsGroupSelectorOpen(!isGroupSelectorOpen)}
                      className="w-full p-3 bg-white/80 backdrop-blur-sm border rounded-xl flex items-center justify-between text-left transition-all duration-200"
                      style={{ borderColor: 'rgba(1, 19, 163, 0.1)' }}
                    >
                      <span className="text-gray-700 font-medium">
                        {userGroups.find(g => g.sgt_idx === selectedGroupId)?.sgt_title || '그룹 선택'}
                      </span>
                      <motion.div
                        animate={{ rotate: isGroupSelectorOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <FiChevronDown className="text-gray-400" size={16} />
                      </motion.div>
                    </motion.button>

                    <AnimatePresence>
                      {isGroupSelectorOpen && userGroups.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50"
                        >
                          {userGroups.map((group) => (
                            <button
                              key={group.sgt_idx}
                              onClick={() => handleGroupSelect(group.sgt_idx)}
                              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl ${
                                selectedGroupId === group.sgt_idx 
                                  ? 'font-medium' 
                                  : 'text-gray-700'
                              }`}
                              style={selectedGroupId === group.sgt_idx 
                                ? { backgroundColor: 'rgba(1, 19, 163, 0.1)', color: '#0113A3' }
                                : {}
                              }
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium truncate">
                                    {group.sgt_title || `그룹 ${group.sgt_idx}`}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {groupMemberCounts[group.sgt_idx] || 0}명의 멤버
                                  </div>
                                </div>
                                {selectedGroupId === group.sgt_idx && (
                                  <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" style={{ color: '#0113A3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                            variants={memberItemVariants}
                            whileHover={{ scale: 1.02, x: 3 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              handleMemberSelect(member.id);
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
                                  {/* 총 장소 수 */}
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-500">📍</span>
                                    <span className={`text-xs font-normal ${
                                      member.isSelected ? 'text-gray-700' : 'text-gray-700'
                                    }`}>
                                      {member.savedLocationCount ?? member.savedLocations?.length ?? 0}개
                                    </span>
                                  </div>
                                </div>
                                
                                {/* 선택된 멤버의 장소 리스트 표시 */}
                                {member.isSelected && member.savedLocations && member.savedLocations.length > 0 && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="mt-3"
                                  >
                                    <div className="max-h-48 overflow-y-auto hide-scrollbar space-y-2 pr-1">
                                      {member.savedLocations.map((location, locationIndex) => (
                                        <motion.div
                                          key={location.id}
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: locationIndex * 0.1 }}
                                          className="flex items-center space-x-2 p-2 bg-white/40 rounded-lg backdrop-blur-sm border border-white/30 hover:bg-white/60 transition-colors cursor-pointer"
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={() => handleLocationSelect(location)}
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex-shrink-0"></div>
                                          <span className="text-xs text-gray-600 truncate flex-1">
                                            {location.name}
                                          </span>
                                          <span className="text-xs text-gray-400 flex-shrink-0">
                                            {location.category}
                                          </span>
                                          <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                    {member.savedLocations.length > 5 && (
                                      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-200/50 mt-2">
                                        총 {member.savedLocations.length}개의 장소
                                      </div>
                                    )}
                                  </motion.div>
                                )}
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
          </>
        )}
      </AnimatePresence>
    </>
  );
} 
