'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// import mapboxgl from 'mapbox-gl'; // Mapbox 임포트 제거
// import 'mapbox-gl/dist/mapbox-gl.css'; // Mapbox CSS 제거
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiMapPin, FiChevronUp, FiChevronDown, FiX, FiLoader } from 'react-icons/fi';
import { FaSearch as FaSearchSolid } from 'react-icons/fa'; // 주소 검색 아이콘 추가
import { toast, ToastContainer } from 'react-toastify'; // react-toastify 임포트
import 'react-toastify/dist/ReactToastify.css'; // react-toastify CSS 임포트
// API_KEYS와 MAP_CONFIG를 config에서 가져오도록 수정
import { API_KEYS, MAP_CONFIG, KAKAO_SHARE } from '../../config'; 
import { PageContainer, Button } from '../components/layout'; // Button 컴포넌트 추가
import ReactDOM from 'react-dom'; // Portal 사용 위해 추가

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

// LocationData 인터페이스 정의
interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  memo: string;
  favorite: boolean;
}

// NewLocationInput 인터페이스 정의 (id가 optional)
interface NewLocationInput {
  id?: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  memo: string;
  favorite: boolean;
}

// 모의 위치 데이터 (LocationData 타입 명시)
const MOCK_LOCATIONS: LocationData[] = [
  {
    id: '1',
    name: '본사 사무실',
    address: '서울시 강남구 테헤란로 123',
    category: '회사',
    coordinates: [127.0381, 37.5012], 
    memo: '본사 사무실 위치입니다.',
    favorite: true
  },
  {
    id: '2',
    name: '강남역 미팅룸',
    address: '서울시 강남구 강남대로 456',
    category: '미팅장소',
    coordinates: [127.0281, 37.4982],
    memo: '주요 미팅 장소',
    favorite: false
  },
  {
    id: '3',
    name: '을지로 지사',
    address: '서울시 중구 을지로 789',
    category: '회사',
    coordinates: [126.9981, 37.5662],
    memo: '을지로 지사 위치',
    favorite: true
  }
];

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
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 40;
  max-height: 90vh;
  overflow-y: auto;
  touch-action: pan-y;
  padding-bottom: 20px;
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
  transform: translateY(calc(100% - 180px));
  height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(calc(100% - 45vh));
  height: 100vh;
}

.bottom-sheet-expanded {
  transform: translateY(0);
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
  top: 20px; /* 화면 상단과의 간격 */
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 40px); /* 양쪽 여백 20px */
  max-width: 480px; /* 최대 너비 */
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  z-index: 45; /* 바텀시트(40)보다 높게, 모달(50)보다 낮게 */
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
}
.location-info-panel.open {
  opacity: 1;
  visibility: visible;
}
.address-search-results-in-panel {
  max-height: 150px; /* 패널 내 검색 결과 높이 제한 */
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-top: 8px;
}
`;

export default function LocationPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<NaverMap | null>(null);
  const markers = useRef<{ [key: string]: NaverMarker }>({});
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const isMapClickedRecentlyRef = useRef(false);
  
  const [locations, setLocations] = useState<LocationData[]>(MOCK_LOCATIONS);
  const [filteredLocations, setFilteredLocations] = useState<LocationData[]>(MOCK_LOCATIONS);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newLocation, setNewLocation] = useState<NewLocationInput>({
    name: '',
    address: '',
    category: '기타',
    coordinates: [127.0276, 37.4979],
    memo: '',
    favorite: false
  });

  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'middle' | 'expanded'>('collapsed');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const currentDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);

  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);

  const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const [locationSearchModalCaller, setLocationSearchModalCaller] = useState<"add" | "edit" | "panel" | null>(null);

  // UI/UX 개선을 위한 새로운 상태 변수들
  const [isSearchingLocationForPanel, setIsSearchingLocationForPanel] = useState(false);
  const [isSavingLocationPanel, setIsSavingLocationPanel] = useState(false);

  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [clickedCoordinates, setClickedCoordinates] = useState<NaverCoord | null>(null); 
  const tempMarker = useRef<NaverMarker | null>(null);
  const [isEditingPanel, setIsEditingPanel] = useState(false);

  useEffect(() => {
    setPortalContainer(document.body);
    const body = document.body;
    console.log('[useEffect for Modals/Panel Open] Overflow check. isAddModalOpen:', isAddModalOpen, 'isEditModalOpen:', isEditModalOpen, 'isLocationSearchModalOpen:', isLocationSearchModalOpen, 'isLocationInfoPanelOpen:', isLocationInfoPanelOpen);
    if (isAddModalOpen || isEditModalOpen || isLocationSearchModalOpen || isLocationInfoPanelOpen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = 'auto';
    }
    return () => {
      body.style.overflow = 'auto';
    };
  }, [isAddModalOpen, isEditModalOpen, isLocationSearchModalOpen, isLocationInfoPanelOpen]);
  
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
      setNaverMapsLoaded(true);
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
            console.log('Naver Map initialized');
            addMarkersToMap(); 
            setIsMapLoading(false);
            if(map.current) map.current.refresh(true);
        });

        window.naver.maps.Event.addListener(map.current, 'click', async (e: { coord: NaverCoord, pointerEvent: MouseEvent }) => { 
          // e.pointerEvent.stopPropagation(); // 일단 이 라인 주석 처리 또는 삭제
          console.log('[Map Click] Event started. Current isLocationInfoPanelOpen:', isLocationInfoPanelOpen, 'isMapClickedRecentlyRef:', isMapClickedRecentlyRef.current);
          isMapClickedRecentlyRef.current = true;
          console.log('[Map Click] isMapClickedRecentlyRef set to true.');

          setClickedCoordinates(e.coord); 
          setIsEditingPanel(false); 
          
          setNewLocation({
            name: '', 
            address: '', 
            category: '기타', 
            coordinates: [e.coord.x, e.coord.y],
            memo: '',
            favorite: false,
          });

          if (tempMarker.current) tempMarker.current.setMap(null);
          tempMarker.current = new window.naver.maps.Marker({
            position: e.coord, 
            map: map.current
          });

          // try {
          //   window.naver.maps.Service.reverseGeocode({
          //       coords: e.coord,
          //       orders: [window.naver.maps.Service.OrderType.ADDR, window.naver.maps.Service.OrderType.ROAD_ADDR].join(\',\')
          //   }, function(status: any, response: any) {
          //       if (status !== window.naver.maps.Service.Status.OK) {
          //           setNewLocation(prev => ({...prev, address: \'\'}));
          //           toast.error(\'선택한 위치의 주소를 가져올 수 없습니다.\');
          //       } else {
          //           const result = response.v2;
          //           const roadAddr = result.address.jibunAddress || result.address.roadAddress;
          //           const fullAddress = roadAddr?.addressElements?.length > 0 ? roadAddr.addressElements.map((el:any)=>el.longName).join(\' \') : (roadAddr || \'주소 정보 없음\');
          //           setNewLocation(prev => ({...prev, address: fullAddress}));
          //       }
          //       console.log(\'[Map Click] Before setIsLocationInfoPanelOpen(true) in reverseGeocode callback.\');
          //       setIsLocationInfoPanelOpen(true);
          //       console.log(\'[Map Click] After setIsLocationInfoPanelOpen(true) in reverseGeocode callback. New state will be pending.\');
          //   });
          // } catch(geoError){ 
          //   setNewLocation(prev => ({...prev, address: \'\'}));
          //   toast.error(\'주소 변환 중 오류가 발생했습니다.\');
          //   console.log(\'[Map Click] Before setIsLocationInfoPanelOpen(true) in catch block.\');
          //   setIsLocationInfoPanelOpen(true);
          //   console.log(\'[Map Click] After setIsLocationInfoPanelOpen(true) in catch block. New state will be pending.\');
          // }
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
      if (tempMarker.current) { tempMarker.current.setMap(null); tempMarker.current = null; }
    };
  }, [naverMapsLoaded]);

  useEffect(() => {
    let filtered = locations;
    if (selectedCategory !== '전체') {
      filtered = filtered.filter(loc => loc.category === selectedCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(loc => 
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        loc.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredLocations(filtered);
    if (map.current && window.naver?.maps && naverMapsLoaded) { 
        updateMarkers(filtered);
    }
  }, [locations, selectedCategory, searchQuery, naverMapsLoaded]);
  
  const getBottomSheetClassName = () => {
    switch (bottomSheetState) {
      case 'collapsed': return 'bottom-sheet-collapsed';
      case 'middle': return 'bottom-sheet-middle';
      case 'expanded': return 'bottom-sheet-expanded';
      default: return 'bottom-sheet-collapsed';
    }
  };
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startDragY.current = clientY;
    currentDragY.current = clientY;
    dragStartTime.current = Date.now();
    if (bottomSheetRef.current) {
      bottomSheetRef.current.style.transition = 'none';
    }
  };
  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (startDragY.current === null || !bottomSheetRef.current || currentDragY.current === null) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - currentDragY.current;
    currentDragY.current = clientY;
    const currentTransform = getComputedStyle(bottomSheetRef.current).transform;
    let currentTranslateY = 0;
    if (currentTransform !== 'none') {
      const matrix = new DOMMatrixReadOnly(currentTransform);
      currentTranslateY = matrix.m42;
    }
    let newTranslateY = currentTranslateY + deltaY;
    const expandedY = 0;
    const collapsedY = window.innerHeight - 180;
    newTranslateY = Math.max(expandedY - (window.innerHeight * 0.1) , Math.min(newTranslateY, collapsedY + 50));
    bottomSheetRef.current.style.transform = `translateY(${newTranslateY}px)`;
  };
  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (startDragY.current === null || !bottomSheetRef.current || currentDragY.current === null) return;
    bottomSheetRef.current.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaYOverall = clientY - startDragY.current;
    const deltaTime = dragStartTime.current ? Date.now() - dragStartTime.current : 0;
    const velocity = deltaTime > 0 ? deltaYOverall / deltaTime : 0;
    const currentTransform = getComputedStyle(bottomSheetRef.current).transform;
    let currentSheetY = 0;
    if (currentTransform !== 'none') {
        const matrix = new DOMMatrixReadOnly(currentTransform);
        currentSheetY = matrix.m42;
    }
    const windowHeight = window.innerHeight;
    const expandedThreshold = windowHeight * 0.1;
    const middleThresholdOpen = windowHeight * 0.4;
    const middleThresholdClose = windowHeight * 0.7;
    if (Math.abs(velocity) > 0.3) { 
        if (velocity < 0) { 
            if (bottomSheetState === 'collapsed') setBottomSheetState('middle');
            else setBottomSheetState('expanded');
        } else { 
            if (bottomSheetState === 'expanded') setBottomSheetState('middle');
            else setBottomSheetState('collapsed');
        }
    } else { 
        if (currentSheetY < expandedThreshold) {
            setBottomSheetState('expanded');
        } else if (currentSheetY < middleThresholdOpen && deltaYOverall < 0) { 
            setBottomSheetState('middle');
        } else if (currentSheetY < middleThresholdClose && currentSheetY >= expandedThreshold) {
            setBottomSheetState('middle');
        } else {
            setBottomSheetState('collapsed');
        }
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
      toast.error("주소 검색 중 오류가 발생했습니다.");
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
    }));

    if (newMapCoord) setClickedCoordinates(newMapCoord); 
    setLocationSearchResults([]); 
    if (tempMarker.current && newMapCoord) tempMarker.current.setPosition(newMapCoord); 
    if (map.current && newMapCoord) map.current.panTo(newMapCoord); 
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
    }));
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
  };

  const handleConfirmPanelAction = async () => {
    if (!(newLocation.address?.trim() || newLocation.name?.trim())) {
      toast.warn("장소 이름 또는 주소를 입력해주세요.");
      return;
    }
    setIsSavingLocationPanel(true);
    try {
      if (isEditingPanel) {
        console.log("Updating location:", newLocation);
        if (!newLocation.id) { 
          toast.error("수정할 장소의 ID가 없습니다.");
          setIsSavingLocationPanel(false);
          return;
        }
        setLocations(prevLocations => prevLocations.map(loc => 
          loc.id === newLocation.id ? { 
            ...loc, 
            name: (newLocation.name?.trim() || newLocation.address || loc.name),
            address: newLocation.address || loc.address,
            category: newLocation.category || loc.category,
            coordinates: newLocation.coordinates || loc.coordinates,
            memo: newLocation.memo || loc.memo,
            favorite: typeof newLocation.favorite === 'boolean' ? newLocation.favorite : loc.favorite,
            id: newLocation.id, 
          } as LocationData : loc 
        ));
        if (selectedLocation && newLocation.id === selectedLocation.id) {
            const updatedSelectedLocation = {
                ...(selectedLocation as LocationData),
                name: (newLocation.name?.trim() || newLocation.address || (selectedLocation as LocationData).name),
                address: newLocation.address || (selectedLocation as LocationData).address,
                category: newLocation.category || (selectedLocation as LocationData).category,
                coordinates: newLocation.coordinates || (selectedLocation as LocationData).coordinates,
                memo: newLocation.memo || (selectedLocation as LocationData).memo,
                favorite: typeof newLocation.favorite === 'boolean' ? newLocation.favorite : (selectedLocation as LocationData).favorite,
                id: newLocation.id,
            }
          setSelectedLocation(updatedSelectedLocation);
        }
        toast.success("장소가 성공적으로 수정되었습니다.");
      } else {
        const newId = String(Date.now());
        const newLocEntry: LocationData = {
          id: newId,
          name: newLocation.name.trim() || newLocation.address, 
          address: newLocation.address, 
          category: newLocation.category, 
          coordinates: newLocation.coordinates, 
          memo: newLocation.memo, 
          favorite: newLocation.favorite, 
        };
        setLocations(prev => [newLocEntry, ...prev]);
        setSelectedLocation(newLocEntry);
        toast.success("새 장소가 등록되었습니다.");
        if (tempMarker.current) {
          tempMarker.current.setMap(null);
        }
      }
      setIsLocationInfoPanelOpen(false);
      setIsEditingPanel(false);
      setNewLocation({ name: '', address: '', category: '기타', coordinates: [127.0276, 37.4979], memo: '', favorite: false });
    } catch (error) {
      toast.error("장소 저장 중 오류가 발생했습니다.");
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

  const addMarkersToMap = () => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) return;
    Object.values(markers.current).forEach(marker => {
      if (marker && typeof marker.setMap === 'function') marker.setMap(null);
    });
    markers.current = {};
    filteredLocations.forEach(location => {
      if (!location.id) {
        console.warn('Location ID is missing, cannot create marker:', location);
        return;
      }
      try {
        const position = new window.naver.maps.LatLng(location.coordinates[1], location.coordinates[0]);
        const isSelected = selectedLocation?.id === location.id;
        
        const iconOptions = isSelected ? {
          path: window.naver.maps.SymbolPath.CIRCLE,
          fillColor: '#FF0000',
          fillOpacity: 0.9,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          radius: 10,
        } : {
          path: window.naver.maps.SymbolPath.CIRCLE,
          fillColor: '#1E90FF',
          fillOpacity: 0.7,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          radius: 8,
        };

        const markerInstance = new window.naver.maps.Marker({
            position: position, 
            map: map.current,
            icon: iconOptions,
            zIndex: isSelected ? 100 : 1
        });

        window.naver.maps.Event.addListener(markerInstance, 'click', (e: any) => {
            setSelectedLocation(location); 
            setNewLocation({ 
                id: location.id, 
                name: location.name,
                address: location.address,
                category: location.category,
                coordinates: location.coordinates, 
                memo: location.memo,
                favorite: location.favorite,
            });
            setClickedCoordinates(new window.naver.maps.LatLng(location.coordinates[1], location.coordinates[0]));
            setIsEditingPanel(true);
            setIsLocationInfoPanelOpen(true);
            if (tempMarker.current) tempMarker.current.setMap(null);
            
            if (bottomSheetState === 'collapsed') setBottomSheetState('middle');
        });
        markers.current[location.id] = markerInstance;
      } catch (error) {
        console.error(`Naver 마커 추가 중 오류 (${location.name}):`, error);
      }
    });
  };
  const updateMarkers = (locationsToUpdate: any[]) => { addMarkersToMap(); };
  const handleLocationListSelect = (location: LocationData) => {
    setSelectedLocation(location);
    if (map.current && window.naver?.maps && location?.coordinates) {
      try {
        const position = new window.naver.maps.LatLng(location.coordinates[1], location.coordinates[0]);
        map.current.morph(position, 15, { duration: 500 });
      } catch (error) {
        console.error('Naver 지도 이동 중 오류가 발생했습니다:', error);
        toast.error('지도를 이동하는 중 오류가 발생했습니다.');
      }
    }
    if (bottomSheetState === 'collapsed') setBottomSheetState('middle');
  };

  const handleAddLocation = () => {
    const locationToAdd: LocationData = { id: String(Date.now()), ...newLocation };
    setLocations(prev => [locationToAdd, ...prev]); 
    toast.success('새 위치가 임시로 추가되었습니다. (저장 필요)');
    setIsAddModalOpen(false);
    setNewLocation({ name: '', address: '', category: '회사', coordinates: [127.0000, 37.5000], memo: '', favorite: false });
  };

  const handleSaveEditLocation = () => {
    if (!selectedLocation || !selectedLocation.id ) {
        toast.warn("편집할 위치가 선택되지 않았습니다.");
        return;
    } 
    const currentId = selectedLocation.id;
    const locationToUpdate: LocationData = {
      id: currentId, 
      name: newLocation.name || selectedLocation.name,
      address: newLocation.address || selectedLocation.address,
      category: newLocation.category || selectedLocation.category,
      coordinates: newLocation.coordinates || selectedLocation.coordinates,
      memo: newLocation.memo || selectedLocation.memo,
      favorite: typeof newLocation.favorite === 'boolean' ? newLocation.favorite : selectedLocation.favorite,
    };
    const updatedLocations = locations.map(loc => 
      loc.id === currentId ? locationToUpdate : loc
    );
    setLocations(updatedLocations);
    setSelectedLocation(locationToUpdate); 
    toast.success("위치 정보가 임시로 수정되었습니다. (저장 필요)");
    setIsEditModalOpen(false);
  };
  const handleDeleteLocation = (id: string) => {
    setLocations(locations.filter(loc => loc.id !== id));
    setSelectedLocation(null);
    toast.success("위치가 삭제되었습니다.");
  };
  const handleToggleFavorite = (id: string) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, favorite: !loc.favorite } : loc
    ));
    if (selectedLocation && selectedLocation.id === id) {
      setSelectedLocation((prev: any) => ({...prev, favorite: !prev.favorite}));
    }
  };

  const handleCloseLocationSearchModal = () => {
    setIsLocationSearchModalOpen(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setLocationSearchModalCaller(null);
  };

  useEffect(() => {
    console.log('[useEffect for handleClickOutside] Registering or unregistering. isLocationInfoPanelOpen:', isLocationInfoPanelOpen);
    const handleClickOutside = (event: MouseEvent) => {
      console.log('[handleClickOutside] Triggered. isMapClickedRecentlyRef:', isMapClickedRecentlyRef.current, 'isLocationInfoPanelOpen:', isLocationInfoPanelOpen);
      if (isMapClickedRecentlyRef.current) {
        console.log('[handleClickOutside] Map was clicked recently. Clearing flag and returning.');
        isMapClickedRecentlyRef.current = false;
        return;
      }
      console.log('[handleClickOutside] Checking if click is outside panel. Panel Ref:', infoPanelRef.current, 'Target:', event.target);
      if (infoPanelRef.current && !infoPanelRef.current.contains(event.target as Node)) {
        if (isLocationInfoPanelOpen) { 
          console.log('[handleClickOutside] Click is outside panel and panel is open. Closing panel.');
          setIsLocationInfoPanelOpen(false);
          if (tempMarker.current) {
            tempMarker.current.setMap(null);
          }
          setIsEditingPanel(false);
        }
      }
    };

    if (isLocationInfoPanelOpen) {
      console.log('[useEffect for handleClickOutside] Adding mousedown listener.');
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      console.log('[useEffect for handleClickOutside] Removing mousedown listener (or not adding if initially false).');
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      console.log('[useEffect for handleClickOutside] Cleanup: Removing mousedown listener.');
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLocationInfoPanelOpen]);

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

        <div 
          ref={infoPanelRef} 
          className={`location-info-panel ${isLocationInfoPanelOpen ? 'open' : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">
              {isEditingPanel ? "장소 정보 수정" : "새 장소 등록"} 
            </h3>
            <button onClick={() => {
              setIsLocationInfoPanelOpen(false);
              if (tempMarker.current) tempMarker.current.setMap(null);
              setIsEditingPanel(false);
            }} className="text-gray-400 hover:text-gray-600">
              <FiX size={20}/>
            </button>
          </div>
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
              <p className="text-xs font-semibold text-gray-500 mt-3 mb-1 px-1">검색 결과:</p>
              <div className="address-search-results-in-panel">
                <ul className="divide-y divide-gray-100">
                  {locationSearchResults.map((place) => (
                    <li key={place.temp_id || place.id} className="p-2 text-xs cursor-pointer hover:bg-gray-100" onClick={() => handleSelectLocationForPanel(place)}>
                      <p className="font-medium text-gray-800 truncate">{place.place_name}</p>
                      <p className="text-gray-600 truncate">{place.road_address_name || place.address_name}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <div className="my-3 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500 mb-1">선택한 위치 주소</p>
            <p className="text-sm font-medium text-gray-700 min-h-[20px]">{isLocationInfoPanelOpen ? (newLocation.address || (clickedCoordinates && !newLocation.address ? '주소 변환 중...' : '지도를 클릭하거나 검색하세요.')) : ''}</p>
          </div>
          <div className="mb-4">
            <label htmlFor="panelLocationName" className="block text-xs font-medium text-gray-500 mb-1">장소 태그 (이름)</label>
            <input
              type="text"
              id="panelLocationName"
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="이 장소에 대한 나만의 이름을 지어주세요."
              value={newLocation.name}
              onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="panelLocationCategory" className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
            <select
              id="panelLocationCategory"
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={newLocation.category}
              onChange={(e) => setNewLocation(prev => ({ ...prev, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.filter(opt => opt.value !== '전체').map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label htmlFor="panelLocationMemo" className="block text-xs font-medium text-gray-500 mb-1">메모</label>
            <textarea
              id="panelLocationMemo"
              rows={2}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="간단한 메모를 남겨보세요."
              value={newLocation.memo}
              onChange={(e) => setNewLocation(prev => ({ ...prev, memo: e.target.value }))}
            />
          </div>
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="panelLocationFavorite"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              checked={newLocation.favorite}
              onChange={(e) => setNewLocation({...newLocation, favorite: e.target.checked})}
            />
            <label htmlFor="panelLocationFavorite" className="ml-2 block text-sm text-gray-700">즐겨찾기에 추가</label>
          </div>
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={() => {
              setIsLocationInfoPanelOpen(false);
              if (tempMarker.current) tempMarker.current.setMap(null);
              setIsEditingPanel(false);
            }} className="flex-1">닫기</Button>
            <Button variant="primary" onClick={handleConfirmPanelAction} className="flex-1" disabled={isSavingLocationPanel}>
              {isSavingLocationPanel ? '저장 중...' : (isEditingPanel ? "수정 완료" : "내 장소 등록")}
            </Button>
          </div>
        </div>

        <div
          ref={bottomSheetRef}
          className={`bottom-sheet ${getBottomSheetClassName()} hide-scrollbar`}
        >
          <div 
            className="bottom-sheet-handle"
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onClick={toggleBottomSheet}
          ></div>

          <div className="px-4 pb-4"> 
            <div className="mb-4">
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="위치 검색"
                  className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <select
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div 
              className="overflow-y-auto"
              style={{
                maxHeight: bottomSheetState === 'expanded' 
                  ? 'calc(90vh - 260px)' 
                  : bottomSheetState === 'middle'
                  ? 'calc(45vh - 220px)'
                  : '50px' 
              }}
            >
              {filteredLocations.length > 0 ? (
                <ul className="space-y-2">
                  {filteredLocations.map(location => (
                    <li 
                      key={location.id}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        selectedLocation?.id === location.id
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-gray-50 border border-gray-100'
                      }`}
                      onClick={() => handleLocationListSelect(location)}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                          <FiMapPin className={`${location.favorite ? 'text-indigo-600' : 'text-gray-400'}`} />
                        </div>
                        <div className="ml-3 flex-1 min-w-0"> 
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">{location.name}</h3>
                            <button 
                              className="text-gray-400 hover:text-indigo-600 p-1 -m-1 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(location.id);
                              }}
                            >
                              {location.favorite ? (
                                <svg className="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{location.category}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{location.address}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">검색 결과가 없습니다.</p>
                </div>
              )}
            </div>

            {selectedLocation && (bottomSheetState === 'expanded' || bottomSheetState === 'middle') && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-semibold text-gray-900 font-suite truncate">{selectedLocation.name}</h2>
                  <div className="flex space-x-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setNewLocation(selectedLocation);
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(selectedLocation.id)}
                      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex">
                    <div className="w-20 flex-shrink-0 text-gray-500">카테고리</div>
                    <div>{selectedLocation.category}</div>
                  </div>
                  <div className="flex">
                    <div className="w-20 flex-shrink-0 text-gray-500">주소</div>
                    <div className="truncate">{selectedLocation.address}</div>
                  </div>
                  <div className="flex">
                    <div className="w-20 flex-shrink-0 text-gray-500">좌표</div>
                    <div>
                      위도: {selectedLocation.coordinates[1].toFixed(6)}, 
                      경도: {selectedLocation.coordinates[0].toFixed(6)}
                    </div>
                  </div>
                  {selectedLocation.memo && (
                    <div className="flex">
                      <div className="w-20 flex-shrink-0 text-gray-500">메모</div>
                      <div>{selectedLocation.memo}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                    setNewLocation({ 
                        name: '',
                        address: '',
                        category: '회사',
                        coordinates: [127.0000, 37.5000],
                        memo: '',
                        favorite: false
                    });
                    setIsAddModalOpen(true)
                }}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FiPlus className="mr-2" />
                새 위치 추가
              </button>
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
              <div>
                <label htmlFor="location-category" className="block text-sm font-medium text-gray-700">카테고리</label>
                <select
                  id="location-category"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.category}
                  onChange={(e) => setNewLocation({...newLocation, category: e.target.value})}
                  required
                >
                  {CATEGORY_OPTIONS.filter(option => option.value !== '전체').map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="location-memo" className="block text-sm font-medium text-gray-700">메모</label>
                <textarea
                  id="location-memo"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.memo}
                  onChange={(e) => setNewLocation({...newLocation, memo: e.target.value})}
                ></textarea>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="location-favorite"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={newLocation.favorite}
                  onChange={(e) => setNewLocation({...newLocation, favorite: e.target.checked})}
                />
                <label htmlFor="location-favorite" className="ml-2 block text-sm text-gray-700">즐겨찾기에 추가</label>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                <Button type="button" onClick={handleAddLocation}>저장</Button>
              </div>
            </form>
          </div>
        )}

        {isEditModalOpen && selectedLocation && renderModal(
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
              <div>
                <label htmlFor="edit-location-category" className="block text-sm font-medium text-gray-700">카테고리</label>
                <select
                  id="edit-location-category"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.category}
                  onChange={(e) => setNewLocation({...newLocation, category: e.target.value})}
                  required
                >
                  {CATEGORY_OPTIONS.filter(option => option.value !== '전체').map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-location-memo" className="block text-sm font-medium text-gray-700">메모</label>
                <textarea
                  id="edit-location-memo"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.memo}
                  onChange={(e) => setNewLocation({...newLocation, memo: e.target.value})}
                ></textarea>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit-location-favorite"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={newLocation.favorite}
                  onChange={(e) => setNewLocation({...newLocation, favorite: e.target.checked})}
                />
                <label htmlFor="edit-location-favorite" className="ml-2 block text-sm text-gray-700">즐겨찾기에 추가</label>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>취소</Button>
                <Button type="button" onClick={handleSaveEditLocation}>저장</Button>
              </div>
            </form>
          </div>
        )}

        {isLocationSearchModalOpen && (locationSearchModalCaller === 'add' || locationSearchModalCaller === 'edit') && renderModal(
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
                  disabled={isSearchingLocation} 
                  className="flex-shrink-0"
                >
                  {isSearchingLocation ? '검색중...' : '검색'}
                </Button>
              </div>
              <div className="overflow-y-auto flex-grow">
                {isSearchingLocation && <p className="text-center text-gray-500 py-4">검색 중...</p>}
                {!isSearchingLocation && locationSearchResults.length === 0 && (<p className="text-center text-gray-500 py-4">검색 결과가 없습니다.</p>)}
                {!isSearchingLocation && locationSearchResults.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mt-2 mb-1 px-1">검색 결과:</p>
                    <ul className="divide-y divide-gray-200">
                      {locationSearchResults.map((place) => (
                        <li key={place.temp_id || place.id} className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2" onClick={() => handleSelectLocationForModals(place)}>
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
          </div>, "location-search-modal-overlay"
        )}

      </PageContainer>
      <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
    </>
  );
} 