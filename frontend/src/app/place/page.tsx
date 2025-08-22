'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  FiMenu,
  FiPlus
} from 'react-icons/fi';
import { hasLocationAndActivityPermissions, requestLocationAndActivityPermissions } from '@/utils/androidPermissions';

// 컴포넌트 import
import MarkerManager from './markerManager';
import LocationPanel from './locationPanel';
import DataManager from './dataManager';

// API 키는 환경 변수에서 가져옴
const API_KEYS = {
  NAVER_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET || '',
  KAKAO_REST_API_KEY: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY || '',
  NAVER_MAPS_CLIENT_ID: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ''
};

// 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

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
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  
  // 위치 정보
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
type NaverMarker = any;
type NaverInfoWindow = any; 

// 유틸리티 함수들
const parseCoordinate = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? null : parsed;
};

const createSafeLatLng = (lat: number, lng: number): any => {
  if (!window.naver?.maps?.LatLng) return null;
  try {
    return new window.naver.maps.LatLng(lat, lng);
  } catch (error) {
    console.error('[createSafeLatLng] LatLng 생성 실패:', error);
    return null;
  }
};

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

const getSafeImageUrl = (photo: string | null, gender: number | null | undefined, index: number): string => {
  if (photo && photo.trim() !== '') {
    return photo;
  }
  return getDefaultImage(gender, index);
};

export default function PlacePage() {
  const router = useRouter();
  
  // 기본 상태 관리
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [map, setMap] = useState<NaverMap | null>(null);
  const [markers, setMarkers] = useState<NaverMarker[]>([]);
  const [memberMarkers, setMemberMarkers] = useState<NaverMarker[]>([]);
  const [infoWindow, setInfoWindow] = useState<NaverInfoWindow | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  
  // 그룹 및 멤버 관련 상태
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  
  // 장소 관련 상태
  const [selectedMemberSavedLocations, setSelectedMemberSavedLocations] = useState<LocationData[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  
  // UI 상태
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  
  // 에러 상태
  const [error, setError] = useState<string | null>(null);

  // 권한 체크
  useEffect(() => {
    const checkLocationPermissions = async () => {
      if (!hasLocationAndActivityPermissions()) {
        try {
          await requestLocationAndActivityPermissions();
        } catch (error) {
          console.error('위치 권한 요청 실패:', error);
        }
      }
    };
    
    const timeoutId = setTimeout(checkLocationPermissions, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // 네이버 지도 로드
  useEffect(() => {
    const loadNaverMaps = async () => {
      if (window.naver && window.naver.maps) {
        setIsMapLoading(false);
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${API_KEYS.NAVER_MAPS_CLIENT_ID}&submodules=geocoder`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        setIsMapLoading(false);
      };
      
      document.head.appendChild(script);
    };

    loadNaverMaps();
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isMapLoading && mapContainer.current && window.naver?.maps && !map) {
      try {
        const mapOptions = {
          center: new window.naver.maps.LatLng(37.5665, 126.9780),
          zoom: 15,
          minZoom: 8,
          maxZoom: 18,
          mapTypeControl: false,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
          zoomControl: false
        };

        const newMap = new window.naver.maps.Map(mapContainer.current, mapOptions);
        
        window.naver.maps.Event.addListener(newMap, 'init', () => {
          setIsMapReady(true);
        });
        
        setMap(newMap);
        
        // 지도 클릭 이벤트
        window.naver.maps.Event.addListener(newMap, 'click', (e: any) => {
          if (infoWindow) {
            infoWindow.close();
            setInfoWindow(null);
          }
          
          // 새 장소 등록을 위한 좌표 설정
          const coordinates: [number, number] = [e.coord.lng(), e.coord.lat()];
          setSelectedLocation({
            id: '',
            name: '',
            address: '',
            category: '기타',
            coordinates,
            memo: '',
            favorite: false,
            notifications: true
          });
          setIsLocationInfoPanelOpen(true);
        });
        
      } catch (error) {
        console.error('[지도 초기화] 오류:', error);
      }
    }
  }, [isMapLoading, map, infoWindow]);

  // 데이터 로드 완료 핸들러
  const handleMembersLoaded = useCallback((members: GroupMember[]) => {
    setGroupMembers(members);
    const selectedMember = members.find(m => m.isSelected);
    if (selectedMember) {
      setSelectedMemberId(selectedMember.id);
      setSelectedMemberSavedLocations(selectedMember.savedLocations);
    }
  }, []);

  const handleLocationsLoaded = useCallback((locations: LocationData[]) => {
    setSelectedMemberSavedLocations(locations);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  // 멤버 선택 핸들러
  const handleMemberSelect = useCallback((memberId: string) => {
    setGroupMembers(prev => 
      prev.map(m => ({ ...m, isSelected: m.id === memberId }))
    );
    setSelectedMemberId(memberId);
    
    const selectedMember = groupMembers.find(m => m.id === memberId);
    if (selectedMember) {
      setSelectedMemberSavedLocations(selectedMember.savedLocations);
    }
    
    // InfoWindow 닫기
    if (infoWindow) {
      infoWindow.close();
      setInfoWindow(null);
    }
  }, [groupMembers, infoWindow]);

  // 장소 마커 클릭 핸들러
  const handleLocationMarkerClick = useCallback((locationId: string) => {
    const location = selectedMemberSavedLocations.find(loc => loc.id === locationId);
    if (location) {
      setSelectedLocation(location);
      setSelectedLocationId(locationId);
      setIsLocationInfoPanelOpen(true);
    }
  }, [selectedMemberSavedLocations]);

  // 멤버 마커 클릭 핸들러
  const handleMemberMarkerClick = useCallback((memberId: string) => {
    handleMemberSelect(memberId);
  }, [handleMemberSelect]);

  // InfoWindow 닫기 핸들러
  const handleInfoWindowClose = useCallback(() => {
    setInfoWindow(null);
  }, []);

  // 장소 저장 핸들러
  const handleLocationSave = useCallback((locationData: NewLocationInput) => {
    if (locationData.id) {
      // 기존 장소 수정
      setSelectedMemberSavedLocations(prev => 
        prev.map(loc => 
          loc.id === locationData.id 
            ? { ...loc, ...locationData } as LocationData
            : loc
        )
      );
      
      // 그룹 멤버 상태도 업데이트
      setGroupMembers(prev => 
        prev.map(member => 
          member.id === selectedMemberId
            ? {
                ...member,
                savedLocations: member.savedLocations.map(loc =>
                  loc.id === locationData.id 
                    ? { ...loc, ...locationData } as LocationData
                    : loc
                )
              }
            : member
        )
      );
    } else {
      // 새 장소 추가
      const newLocation: LocationData = {
        id: `temp_${Date.now()}`,
        ...locationData
      } as LocationData;
      
      setSelectedMemberSavedLocations(prev => [...prev, newLocation]);
      
      // 그룹 멤버 상태도 업데이트
      setGroupMembers(prev => 
        prev.map(member => 
          member.id === selectedMemberId
            ? {
                ...member,
                savedLocations: [...member.savedLocations, newLocation],
                savedLocationCount: (member.savedLocationCount || 0) + 1
              }
            : member
        )
      );
    }
    
    setIsLocationInfoPanelOpen(false);
  }, [selectedMemberId]);

  // 장소 삭제 핸들러
  const handleLocationDelete = useCallback((locationId: string) => {
    setSelectedMemberSavedLocations(prev => 
      prev.filter(loc => loc.id !== locationId)
    );
    
    // 그룹 멤버 상태도 업데이트
    setGroupMembers(prev => 
      prev.map(member => 
        member.id === selectedMemberId
          ? {
              ...member,
              savedLocations: member.savedLocations.filter(loc => loc.id !== locationId),
              savedLocationCount: Math.max(0, (member.savedLocationCount || 0) - 1)
            }
          : member
      )
    );
    
    if (selectedLocationId === locationId) {
      setSelectedLocationId(null);
      setSelectedLocation(null);
    }
  }, [selectedMemberId, selectedLocationId]);

  // 알림 토글 핸들러
  const handleNotificationToggle = useCallback((location: LocationData) => {
    const updatedLocation = { ...location, notifications: !location.notifications };
    
    setSelectedMemberSavedLocations(prev => 
      prev.map(loc => 
        loc.id === location.id ? updatedLocation : loc
      )
    );
    
    // 그룹 멤버 상태도 업데이트
    setGroupMembers(prev => 
      prev.map(member => 
        member.id === selectedMemberId
          ? {
              ...member,
              savedLocations: member.savedLocations.map(loc =>
                loc.id === location.id ? updatedLocation : loc
              )
            }
          : member
      )
    );
    
    if (selectedLocation?.id === location.id) {
      setSelectedLocation(updatedLocation);
    }
  }, [selectedMemberId, selectedLocation]);

  // 뒤로가기 핸들러
  const handleBack = () => {
    router.back();
  };

  // 사이드바 토글
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 새 장소 등록 패널 열기
  const openNewLocationPanel = () => {
    setSelectedLocation(null);
    setSelectedLocationId(null);
    setIsLocationInfoPanelOpen(true);
  };

  return (
    <div className="full-map-container">
      {/* 데이터 매니저 */}
      <DataManager
        onMembersLoaded={handleMembersLoaded}
        onLocationsLoaded={handleLocationsLoaded}
        onError={handleError}
      />

      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900">장소 관리</h1>
          
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiMenu className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* 지도 컨테이너 */}
      <div 
        ref={mapContainer}
        className="w-full h-full"
        style={{ marginTop: '56px' }}
      />

      {/* 로딩 스켈레톤 */}
      {isMapLoading && (
        <div className="fixed inset-0 bg-white z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">지도를 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* 마커 매니저 */}
      {map && isMapReady && (
        <MarkerManager
          map={map}
          groupMembers={groupMembers}
          selectedMemberId={selectedMemberId}
          selectedMemberSavedLocations={selectedMemberSavedLocations}
          selectedLocationId={selectedLocationId}
          onMarkerClick={handleLocationMarkerClick}
          onMemberMarkerClick={handleMemberMarkerClick}
          onInfoWindowClose={handleInfoWindowClose}
        />
      )}

      {/* 사이드바 */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={toggleSidebar}
            />
            
            {/* 사이드바 */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 overflow-y-auto"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">멤버 목록</h2>
                  <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {groupMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        member.isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleMemberSelect(member.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/avatar1.png';
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">
                            장소 {member.savedLocationCount || member.savedLocations?.length || 0}개
                          </div>
                        </div>
                        {member.isSelected && (
                          <FiCheckCircle className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 장소 정보 패널 */}
      <LocationPanel
        isOpen={isLocationInfoPanelOpen}
        onClose={() => setIsLocationInfoPanelOpen(false)}
        selectedLocation={selectedLocation}
        onSave={handleLocationSave}
        onDelete={handleLocationDelete}
        onNotificationToggle={handleNotificationToggle}
      />

      {/* 플로팅 버튼 */}
      <motion.button
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-30 flex items-center justify-center"
        onClick={openNewLocationPanel}
      >
        <FiPlus className="w-6 h-6" />
      </motion.button>

      {/* 에러 표시 */}
      {error && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
