'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import Image from 'next/image';
import { 
  FiMapPin, 
  FiPlus, 
  FiEdit3, 
  FiTrash2, 
  FiSearch, 
  FiX, 
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiBell,
  FiBellOff,
  FiHeart,
  FiMoreVertical,
  FiFilter,
  FiNavigation,
  FiLoader
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 타입 정의
interface LocationData {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  memo: string;
  favorite: boolean;
  notifications: boolean;
  memberName?: string;
  memberPhoto?: string;
  createdAt?: string;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: { lat: number; lng: number };
  savedLocations: LocationData[];
  mt_gender?: number | null;
  original_index: number;
}

interface SearchResult {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // longitude
  y: string; // latitude
}

// 카테고리 옵션
const CATEGORY_OPTIONS = [
  { value: '전체', label: '전체', color: 'bg-gray-500', icon: '📍' },
  { value: '회사', label: '회사', color: 'bg-blue-500', icon: '🏢' },
  { value: '미팅장소', label: '미팅장소', color: 'bg-purple-500', icon: '🤝' },
  { value: '식당', label: '식당', color: 'bg-orange-500', icon: '🍽️' },
  { value: '카페', label: '카페', color: 'bg-amber-500', icon: '☕' },
  { value: '기타', label: '기타', color: 'bg-green-500', icon: '📌' }
];

// 모의 데이터
const MOCK_GROUP_MEMBERS: GroupMember[] = [
  {
    id: '1',
    name: '김철수',
    photo: '/images/avatar3.png',
    isSelected: true,
    location: { lat: 37.5665, lng: 126.9780 },
    savedLocations: [
      {
        id: 'loc1-1',
        name: '철수네 회사',
        address: '서울시 강남구 테헤란로 100',
        category: '회사',
        coordinates: [127.0350, 37.5000],
        memo: '매일 출근하는 곳',
        favorite: true,
        notifications: true,
        createdAt: '2024-01-15'
      },
      {
        id: 'loc1-2',
        name: '철수 단골식당',
        address: '서울시 강남구 역삼동 101',
        category: '식당',
        coordinates: [127.0380, 37.5015],
        memo: '점심 맛집',
        favorite: false,
        notifications: false,
        createdAt: '2024-01-20'
      }
    ],
    mt_gender: 1,
    original_index: 0
  },
  {
    id: '2',
    name: '이영희',
    photo: '/images/avatar1.png',
    isSelected: false,
    location: { lat: 37.4982, lng: 127.0281 },
    savedLocations: [
      {
        id: 'loc2-1',
        name: '영희네 집',
        address: '서울시 서초구 반포동 200',
        category: '기타',
        coordinates: [127.0010, 37.5100],
        memo: '우리집',
        favorite: true,
        notifications: false,
        createdAt: '2024-01-10'
      },
      {
        id: 'loc2-2',
        name: '영희 헬스장',
        address: '서울시 서초구 잠원동 202',
        category: '기타',
        coordinates: [127.0090, 37.5120],
        memo: '운동하는 곳',
        favorite: false,
        notifications: true,
        createdAt: '2024-01-25'
      }
    ],
    mt_gender: 2,
    original_index: 1
  },
  {
    id: '3',
    name: '박민수',
    photo: '/images/avatar2.png',
    isSelected: false,
    location: { lat: 37.5662, lng: 126.9981 },
    savedLocations: [
      {
        id: 'loc3-1',
        name: '민수 스터디룸',
        address: '서울시 종로구 관철동 300',
        category: '미팅장소',
        coordinates: [126.9850, 37.5690],
        memo: '그룹 스터디 장소',
        favorite: false,
        notifications: false,
        createdAt: '2024-02-01'
      }
    ],
    mt_gender: 1,
    original_index: 2
  }
];

// 기본 이미지 가져오는 함수
const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const imageNumber = (index % 4) + 1;
  if (gender === 1) {
    return `/images/male_${imageNumber}.png`;
  } else if (gender === 2) {
    return `/images/female_${imageNumber}.png`;
  }
  return `/images/avatar${(index % 3) + 1}.png`;
};

// 애니메이션 variants
const pageVariants = {
  initial: { opacity: 0, x: '100%' },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: '-100%' }
};

const bottomSheetVariants = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  hover: { y: -4, scale: 1.02 }
};

export default function LocationPage() {
  const router = useRouter();
  
  // 상태 관리
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(MOCK_GROUP_MEMBERS);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(MOCK_GROUP_MEMBERS[0]);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 새 장소 데이터
  const [newLocation, setNewLocation] = useState<Partial<LocationData>>({
    name: '',
    address: '',
    category: '기타',
    memo: '',
    favorite: false,
    notifications: false
  });

  // 지도 관련 상태
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]); // 마커들을 별도 배열로 관리
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // 필터링된 장소 목록
  const filteredLocations = selectedMember?.savedLocations.filter(location => {
    const matchesCategory = selectedCategory === '전체' || location.category === selectedCategory;
    const matchesSearch = location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         location.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  // 지도 초기화
  useEffect(() => {
    const initMap = () => {
      if (!mapContainer.current || !window.naver) return;

      const mapOptions = {
        center: new window.naver.maps.LatLng(37.5665, 126.9780),
        zoom: 15,
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

      map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);
      setIsMapLoaded(true);
      
      // 지도 클릭 이벤트
      window.naver.maps.Event.addListener(map.current, 'click', (e: any) => {
        const coord = e.coord;
        setNewLocation(prev => ({
          ...prev,
          coordinates: [coord.lng(), coord.lat()]
        }));
        
        // 주소 변환
        if (window.naver.maps.Service) {
          window.naver.maps.Service.reverseGeocode({
            coords: coord,
            orders: [window.naver.maps.Service.OrderType.ADDR, window.naver.maps.Service.OrderType.ROAD_ADDR].join(',')
          }, (status: any, response: any) => {
            if (status === window.naver.maps.Service.Status.OK) {
              const result = response.v2;
              const address = result.address?.jibunAddress || result.roadAddress?.roadAddress || '';
              setNewLocation(prev => ({
                ...prev,
                address
              }));
            }
          });
        }
      });
    };

    // 네이버 지도 API 로드
    if (!window.naver) {
      const script = document.createElement('script');
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID}&submodules=geocoder`;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    // 컴포넌트 언마운트 시 마커 정리
    return () => {
      markers.current.forEach((marker: any) => {
        try {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
          }
        } catch (error) {
          console.warn('마커 정리 중 오류:', error);
        }
      });
      markers.current = [];
    };
  }, []);

  // 마커 업데이트
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // 기존 마커 제거 - 더 안전한 방식
    markers.current.forEach((marker: any) => {
      try {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(null);
        }
      } catch (error) {
        console.warn('마커 제거 중 오류:', error);
      }
    });
    markers.current = [];

    // 새 마커 추가
    filteredLocations.forEach((location, index) => {
      try {
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(location.coordinates[1], location.coordinates[0]),
          map: map.current,
          title: location.name,
          icon: {
            content: `
              <div class="marker ${selectedLocationId === location.id ? 'selected' : ''}" style="
                width: 40px;
                height: 40px;
                background: ${selectedLocationId === location.id ? '#6366f1' : '#ef4444'};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: all 0.2s ease;
              ">
                <span style="color: white; font-size: 16px;">${CATEGORY_OPTIONS.find(cat => cat.value === location.category)?.icon || '📍'}</span>
              </div>
            `,
            size: new window.naver.maps.Size(40, 40),
            anchor: new window.naver.maps.Point(20, 20)
          }
        });

        // 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          setSelectedLocationId(location.id);
          setNewLocation(location);
          setIsBottomSheetOpen(true);
        });

        markers.current.push(marker);
      } catch (error) {
        console.warn('마커 생성 중 오류:', error);
      }
    });
  }, [filteredLocations, selectedLocationId, isMapLoaded]);

  // 멤버 선택
  const handleMemberSelect = (member: GroupMember) => {
    setGroupMembers(prev => prev.map(m => ({ ...m, isSelected: m.id === member.id })));
    setSelectedMember(member);
    setSelectedLocationId(null);
    
    if (map.current && member.savedLocations.length > 0) {
      const firstLocation = member.savedLocations[0];
      map.current.setCenter(new window.naver.maps.LatLng(
        firstLocation.coordinates[1],
        firstLocation.coordinates[0]
      ));
    }
  };

  // 장소 검색
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // 카카오 API를 사용한 장소 검색 (실제 구현 시)
      // 여기서는 모의 데이터 사용
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResults: SearchResult[] = [
        {
          id: '1',
          place_name: '강남역',
          address_name: '서울 강남구 역삼동',
          road_address_name: '서울 강남구 강남대로 396',
          x: '127.027926',
          y: '37.497952'
        },
        {
          id: '2',
          place_name: '홍대입구역',
          address_name: '서울 마포구 동교동',
          road_address_name: '서울 마포구 양화로 160',
          x: '126.924191',
          y: '37.557192'
        }
      ];
      
      setSearchResults(mockResults);
    } catch (error) {
      toast.error('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 장소 추가
  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.address) {
      toast.error('장소명과 주소를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const location: LocationData = {
        id: Date.now().toString(),
        name: newLocation.name,
        address: newLocation.address,
        category: newLocation.category || '기타',
        coordinates: newLocation.coordinates || [126.9780, 37.5665],
        memo: newLocation.memo || '',
        favorite: newLocation.favorite || false,
        notifications: newLocation.notifications || false,
        createdAt: new Date().toISOString().split('T')[0]
      };

      if (selectedMember) {
        setGroupMembers(prev => prev.map(member => 
          member.id === selectedMember.id 
            ? { ...member, savedLocations: [...member.savedLocations, location] }
            : member
        ));
        setSelectedMember(prev => prev ? { ...prev, savedLocations: [...prev.savedLocations, location] } : null);
      }

      setNewLocation({
        name: '',
        address: '',
        category: '기타',
        memo: '',
        favorite: false,
        notifications: false
      });
      setIsAddModalOpen(false);
      toast.success('장소가 추가되었습니다.');
    } catch (error) {
      toast.error('장소 추가 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 장소 수정
  const handleEditLocation = async () => {
    if (!newLocation.id || !newLocation.name || !newLocation.address) {
      toast.error('필수 정보를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (selectedMember) {
        setGroupMembers(prev => prev.map(member => 
          member.id === selectedMember.id 
            ? { 
                ...member, 
                savedLocations: member.savedLocations.map(loc => 
                  loc.id === newLocation.id ? { ...loc, ...newLocation } as LocationData : loc
                )
              }
            : member
        ));
        setSelectedMember(prev => prev ? {
          ...prev,
          savedLocations: prev.savedLocations.map(loc => 
            loc.id === newLocation.id ? { ...loc, ...newLocation } as LocationData : loc
          )
        } : null);
      }

      setIsEditModalOpen(false);
      setIsBottomSheetOpen(false);
      toast.success('장소가 수정되었습니다.');
    } catch (error) {
      toast.error('장소 수정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 장소 삭제
  const handleDeleteLocation = async (locationId: string) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (selectedMember) {
        setGroupMembers(prev => prev.map(member => 
          member.id === selectedMember.id 
            ? { ...member, savedLocations: member.savedLocations.filter(loc => loc.id !== locationId) }
            : member
        ));
        setSelectedMember(prev => prev ? {
          ...prev,
          savedLocations: prev.savedLocations.filter(loc => loc.id !== locationId)
        } : null);
      }

      setIsBottomSheetOpen(false);
      setSelectedLocationId(null);
      toast.success('장소가 삭제되었습니다.');
    } catch (error) {
      toast.error('장소 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 뒤로가기
  const handleBack = () => {
    router.back();
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50"
    >
      {/* 헤더 */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="sticky top-0 z-20 px-4 bg-white/90 backdrop-blur-md border-b border-gray-200/50"
      >
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiChevronLeft className="w-5 h-5 text-gray-700" />
            </motion.button>
            <div className="flex items-center space-x-2">
              <FiMapPin className="w-5 h-5 text-indigo-600" />
              <span className="text-lg font-semibold text-gray-900">내 장소</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiSearch className="w-5 h-5 text-gray-700" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAddModalOpen(true)}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors"
            >
              <FiPlus className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 지도 영역 */}
      <div className="relative h-[calc(100vh-3.5rem)]">
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* 로딩 오버레이 */}
        <AnimatePresence>
          {!isMapLoaded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="text-center">
                <FiLoader className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">지도를 불러오는 중...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 멤버 선택 카드 */}
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute top-4 left-4 right-4 z-10"
        >
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <FiUsers className="w-4 h-4 mr-2 text-indigo-600" />
                그룹 멤버
              </h3>
              <span className="text-xs text-gray-500">{filteredLocations.length}개 장소</span>
            </div>
            
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {groupMembers.map((member, index) => (
                <motion.button
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleMemberSelect(member)}
                  className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl transition-all ${
                    member.isSelected 
                      ? 'bg-indigo-100 ring-2 ring-indigo-500' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="relative">
                    <Image
                      src={member.photo ?? getDefaultImage(member.mt_gender, member.original_index)}
                      alt={member.name}
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-white shadow-sm"
                    />
                    {member.isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <HiSparkles className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-medium mt-1 ${
                    member.isSelected ? 'text-indigo-700' : 'text-gray-700'
                  }`}>
                    {member.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 카테고리 필터 */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-4 left-4 right-4 z-10"
        >
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <FiFilter className="w-4 h-4 mr-2 text-indigo-600" />
                카테고리
              </h3>
              <span className="text-xs text-gray-500">
                {selectedMember?.name}의 장소
              </span>
            </div>
            
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {CATEGORY_OPTIONS.map((category) => (
                <motion.button
                  key={category.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex-shrink-0 flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    selectedCategory === category.value
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 바텀시트 - 장소 상세 정보 */}
      <AnimatePresence>
        {isBottomSheetOpen && newLocation.id && (
          <motion.div
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > 100) {
                setIsBottomSheetOpen(false);
              }
            }}
          >
            {/* 드래그 핸들 */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
            
            <div className="px-6 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {newLocation.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">
                    {newLocation.address}
                  </p>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      CATEGORY_OPTIONS.find(cat => cat.value === newLocation.category)?.color || 'bg-gray-500'
                    } text-white`}>
                      {CATEGORY_OPTIONS.find(cat => cat.value === newLocation.category)?.icon} {newLocation.category}
                    </span>
                    {newLocation.favorite && (
                      <FiHeart className="w-4 h-4 text-red-500 fill-current" />
                    )}
                    {newLocation.notifications ? (
                      <FiBell className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <FiBellOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsBottomSheetOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              {newLocation.memo && (
                <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-700">{newLocation.memo}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsEditModalOpen(true);
                    setIsBottomSheetOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                >
                  <FiEdit3 className="w-4 h-4" />
                  <span>수정</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => newLocation.id && handleDeleteLocation(newLocation.id)}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  <span>삭제</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 추가 모달 */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsAddModalOpen(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">새 장소 추가</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    장소명 *
                  </label>
                  <input
                    type="text"
                    value={newLocation.name || ''}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="장소명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주소 *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newLocation.address || ''}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="주소를 입력하세요"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsSearchModalOpen(true)}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                      <FiSearch className="w-5 h-5 text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리
                  </label>
                  <select
                    value={newLocation.category || '기타'}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  >
                    {CATEGORY_OPTIONS.filter(cat => cat.value !== '전체').map(category => (
                      <option key={category.value} value={category.value}>
                        {category.icon} {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    메모
                  </label>
                  <textarea
                    value={newLocation.memo || ''}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, memo: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                    rows={3}
                    placeholder="메모를 입력하세요"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newLocation.favorite || false}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, favorite: e.target.checked }))}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">즐겨찾기</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newLocation.notifications || false}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, notifications: e.target.checked }))}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">알림</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddLocation}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '추가 중...' : '추가'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 수정 모달 */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsEditModalOpen(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">장소 수정</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    장소명 *
                  </label>
                  <input
                    type="text"
                    value={newLocation.name || ''}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="장소명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주소 *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newLocation.address || ''}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="주소를 입력하세요"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsSearchModalOpen(true)}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                      <FiSearch className="w-5 h-5 text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리
                  </label>
                  <select
                    value={newLocation.category || '기타'}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  >
                    {CATEGORY_OPTIONS.filter(cat => cat.value !== '전체').map(category => (
                      <option key={category.value} value={category.value}>
                        {category.icon} {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    메모
                  </label>
                  <textarea
                    value={newLocation.memo || ''}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, memo: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                    rows={3}
                    placeholder="메모를 입력하세요"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newLocation.favorite || false}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, favorite: e.target.checked }))}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">즐겨찾기</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newLocation.notifications || false}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, notifications: e.target.checked }))}
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">알림</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditLocation}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '수정 중...' : '수정'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 검색 모달 */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsSearchModalOpen(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">장소 검색</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSearchModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="장소명, 주소를 검색하세요"
                  autoFocus
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isSearching}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSearching ? <FiLoader className="w-5 h-5 animate-spin" /> : <FiSearch className="w-5 h-5" />}
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-8">
                    <FiLoader className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                    <p className="text-gray-600">검색 중...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <motion.button
                        key={result.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setNewLocation(prev => ({
                            ...prev,
                            name: result.place_name,
                            address: result.road_address_name || result.address_name,
                            coordinates: [parseFloat(result.x), parseFloat(result.y)]
                          }));
                          setIsSearchModalOpen(false);
                        }}
                        className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <h4 className="font-medium text-gray-900 mb-1">{result.place_name}</h4>
                        <p className="text-sm text-gray-600">{result.road_address_name || result.address_name}</p>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FiNavigation className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">검색 결과가 없습니다</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </motion.div>
  );
}