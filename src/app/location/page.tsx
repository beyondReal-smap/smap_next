'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMapPin, 
  FiPlus, 
  FiEdit3, 
  FiTrash2, 
  FiSearch, 
  FiFilter, 
  FiUsers, 
  FiX,
  FiSave,
  FiNavigation,
  FiMoreVertical,
  FiChevronDown,
  FiChevronUp,
  FiHome,
  FiStar,
  FiHeart,
  FiCoffee,
  FiShoppingBag,
  FiEye,
  FiSettings,
  FiChevronRight
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// 모바일 최적화된 CSS 애니메이션
const pageAnimations = `
html, body {
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.animate-slideInFromRight {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.animate-slideInFromBottom {
  animation: slideInFromBottom 0.3s ease-out forwards;
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.mobile-button {
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
}

.mobile-button:active {
  transform: scale(0.98);
}

.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.glass-effect {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}

.menu-item-hover {
  transition: all 0.2s ease;
}

.menu-item-hover:hover {
  transform: translateX(4px);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.floating-shadow {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
}

.marker-glow {
  filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
}
`;

// 장소 타입 정의
interface LocationData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  description?: string;
  addedBy: string;
  addedAt: Date;
  tags: string[];
  rating?: number;
  photos?: string[];
}

// 그룹 멤버 타입 정의
interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

// 카테고리 정의 - 개선된 디자인
const LOCATION_CATEGORIES = [
  { id: 'restaurant', name: '맛집', icon: FiCoffee, color: '#ef4444', bgColor: 'bg-red-500' },
  { id: 'shopping', name: '쇼핑', icon: FiShoppingBag, color: '#f59e0b', bgColor: 'bg-amber-500' },
  { id: 'attraction', name: '관광지', icon: FiStar, color: '#10b981', bgColor: 'bg-emerald-500' },
  { id: 'accommodation', name: '숙박', icon: FiHome, color: '#3b82f6', bgColor: 'bg-blue-500' },
  { id: 'favorite', name: '즐겨찾기', icon: FiHeart, color: '#ec4899', bgColor: 'bg-pink-500' },
  { id: 'other', name: '기타', icon: FiMapPin, color: '#6b7280', bgColor: 'bg-gray-500' }
];

// 모의 데이터
const MOCK_GROUP_MEMBERS: GroupMember[] = [
  { id: '1', name: '김철수', color: '#ef4444' },
  { id: '2', name: '이영희', color: '#10b981' },
  { id: '3', name: '박민수', color: '#3b82f6' },
  { id: '4', name: '최지영', color: '#f59e0b' }
];

const MOCK_LOCATIONS: LocationData[] = [
  {
    id: '1',
    name: '강남역 맛집',
    address: '서울특별시 강남구 강남대로 지하 396',
    latitude: 37.4979,
    longitude: 127.0276,
    category: 'restaurant',
    description: '유명한 한식당',
    addedBy: '김철수',
    addedAt: new Date('2024-01-15'),
    tags: ['한식', '점심', '회식'],
    rating: 4.5
  },
  {
    id: '2',
    name: '홍대 쇼핑몰',
    address: '서울특별시 마포구 양화로 188',
    latitude: 37.5563,
    longitude: 126.9236,
    category: 'shopping',
    description: '트렌디한 쇼핑몰',
    addedBy: '이영희',
    addedAt: new Date('2024-01-20'),
    tags: ['쇼핑', '패션', '카페'],
    rating: 4.2
  }
];

const LocationPage: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [locations, setLocations] = useState<LocationData[]>(MOCK_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.9780 }); // 서울 중심
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showMemberFilter, setShowMemberFilter] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    category: 'restaurant',
    description: '',
    tags: [] as string[],
    rating: 0
  });

  // 페이지 로드 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 지도 로드 핸들러
  const onMapLoad = (map: google.maps.Map) => {
    setMap(map);
  };

  // 마커 클릭 핸들러
  const handleMarkerClick = (location: LocationData) => {
    setSelectedLocation(location);
    setShowInfoWindow(true);
    setShowBottomSheet(true);
  };

  // 장소 추가 핸들러
  const handleAddLocation = () => {
    if (!newLocation.name || !newLocation.address) return;

    const location: LocationData = {
      id: Date.now().toString(),
      name: newLocation.name,
      address: newLocation.address,
      latitude: center.lat + (Math.random() - 0.5) * 0.01,
      longitude: center.lng + (Math.random() - 0.5) * 0.01,
      category: newLocation.category,
      description: newLocation.description,
      addedBy: '현재 사용자',
      addedAt: new Date(),
      tags: newLocation.tags,
      rating: newLocation.rating
    };

    setLocations([...locations, location]);
    setShowAddModal(false);
    setNewLocation({
      name: '',
      address: '',
      category: 'restaurant',
      description: '',
      tags: [],
      rating: 0
    });
  };

  // 장소 수정 핸들러
  const handleEditLocation = () => {
    if (!editingLocation) return;

    setLocations(locations.map(loc => 
      loc.id === editingLocation.id ? editingLocation : loc
    ));
    setShowEditModal(false);
    setEditingLocation(null);
  };

  // 장소 삭제 핸들러
  const handleDeleteLocation = (id: string) => {
    setLocations(locations.filter(loc => loc.id !== id));
    setShowBottomSheet(false);
    setShowInfoWindow(false);
  };

  // 필터링된 장소 목록
  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         location.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || location.category === selectedCategory;
    const matchesMember = selectedMember === 'all' || location.addedBy === selectedMember;
    
    return matchesSearch && matchesCategory && matchesMember;
  });

  // 마커 렌더링
  const renderMarkers = () => {
    return filteredLocations.map((location) => {
      const category = LOCATION_CATEGORIES.find(cat => cat.id === location.category);
      const member = MOCK_GROUP_MEMBERS.find(m => m.name === location.addedBy);
      const markerColor = member?.color || category?.color || '#6b7280';
      const isSelected = selectedLocation?.id === location.id;
      const markerSize = isSelected ? 45 : 35;

      return (
        <Marker
          key={location.id}
          position={{ lat: location.latitude, lng: location.longitude }}
          onClick={() => handleMarkerClick(location)}
          icon={{
            url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 24 24" fill="${markerColor}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
            scaledSize: new google.maps.Size(markerSize, markerSize),
            anchor: new google.maps.Point(markerSize / 2, markerSize),
          }}
        />
      );
    });
  };

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCenter(newCenter);
          if (map) {
            map.panTo(newCenter);
          }
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  return (
    <>
      <style jsx global>{pageAnimations}</style>
      <div className={`bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen ${
        isPageLoaded ? 'animate-fadeIn' : 'opacity-0'
      }`}>
        {/* 개선된 헤더 */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-20 glass-effect border-b border-white/20 shadow-sm"
        >
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FiMapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">우리의 장소</h1>
                  <p className="text-sm text-gray-600">{filteredLocations.length}개의 특별한 장소</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddModal(true)}
                className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mobile-button"
              >
                <FiPlus className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            {/* 개선된 검색 바 */}
            <div className="relative mb-4">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="장소를 검색해보세요..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/80 border-0 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
              />
            </div>

            {/* 개선된 필터 버튼들 */}
            <div className="flex space-x-3 overflow-x-auto pb-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm mobile-button ${
                  selectedCategory === 'all' 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' 
                    : 'bg-white/80 text-gray-600 hover:bg-white'
                }`}
              >
                전체
              </motion.button>
              {LOCATION_CATEGORIES.map((category) => (
                <motion.button
                  key={category.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm mobile-button flex items-center space-x-2 ${
                    selectedCategory === category.id 
                      ? 'text-white shadow-lg' 
                      : 'bg-white/80 text-gray-600 hover:bg-white'
                  }`}
                  style={{
                    background: selectedCategory === category.id 
                      ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)` 
                      : undefined
                  }}
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.name}</span>
                </motion.button>
              ))}
            </div>

            {/* 멤버 필터 */}
            <div className="flex items-center justify-between mt-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMemberFilter(!showMemberFilter)}
                className="flex items-center space-x-2 px-3 py-2 bg-white/80 rounded-xl text-sm font-medium text-gray-600 hover:bg-white transition-all shadow-sm mobile-button"
              >
                <FiUsers className="w-4 h-4" />
                <span>멤버 필터</span>
                <motion.div
                  animate={{ rotate: showMemberFilter ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FiChevronDown className="w-4 h-4" />
                </motion.div>
              </motion.button>
            </div>

            {/* 멤버 필터 드롭다운 */}
            <AnimatePresence>
              {showMemberFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="bg-white/90 rounded-xl p-3 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedMember('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all mobile-button ${
                          selectedMember === 'all'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        전체 멤버
                      </motion.button>
                      {MOCK_GROUP_MEMBERS.map((member) => (
                        <motion.button
                          key={member.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedMember(member.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all mobile-button ${
                            selectedMember === member.name
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={{
                            backgroundColor: selectedMember === member.name ? member.color : undefined
                          }}
                        >
                          {member.name}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 지도 영역 */}
        <div className="relative" style={{ height: 'calc(100vh - 280px)' }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={13}
            onLoad={onMapLoad}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                },
                {
                  featureType: 'water',
                  elementType: 'geometry',
                  stylers: [{ color: '#e3f2fd' }]
                },
                {
                  featureType: 'landscape',
                  elementType: 'geometry',
                  stylers: [{ color: '#f8f9fa' }]
                }
              ]
            }}
          >
            {renderMarkers()}
            
            {showInfoWindow && selectedLocation && (
              <InfoWindow
                position={{
                  lat: selectedLocation.latitude,
                  lng: selectedLocation.longitude,
                }}
                onCloseClick={() => {
                  setShowInfoWindow(false);
                  setShowBottomSheet(false);
                }}
              >
                <div className="p-3 max-w-xs">
                  <h3 className="font-bold text-base text-gray-900">{selectedLocation.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedLocation.address}</p>
                  {selectedLocation.rating && (
                    <div className="flex items-center space-x-1 mt-2">
                      <FiStar className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium text-gray-700">{selectedLocation.rating}</span>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* 개선된 플로팅 버튼들 */}
          <div className="absolute bottom-6 right-4 space-y-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={moveToCurrentLocation}
              className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center mobile-button floating-shadow"
            >
              <FiNavigation className="w-6 h-6 text-indigo-600" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddModal(true)}
              className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center mobile-button floating-shadow animate-pulse"
            >
              <FiPlus className="w-6 h-6 text-white" />
            </motion.button>
          </div>
        </div>

        {/* 개선된 하단 시트 */}
        <AnimatePresence>
          {showBottomSheet && selectedLocation && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30 max-h-[70vh] overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
                
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-12 h-12 ${LOCATION_CATEGORIES.find(cat => cat.id === selectedLocation.category)?.bgColor || 'bg-gray-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                        {React.createElement(LOCATION_CATEGORIES.find(cat => cat.id === selectedLocation.category)?.icon || FiMapPin, {
                          className: "w-6 h-6 text-white"
                        })}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedLocation.name}</h3>
                        {selectedLocation.rating && (
                          <div className="flex items-center space-x-1 mt-1">
                            <FiStar className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm font-medium text-gray-700">{selectedLocation.rating}</span>
                            <span className="text-xs text-gray-500">• 평점</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2">
                        <FiMapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-600">{selectedLocation.address}</p>
                      </div>
                      
                      {selectedLocation.description && (
                        <div className="flex items-start space-x-2">
                          <FiEye className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-800">{selectedLocation.description}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <FiUsers className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">추가한 사람:</span>
                        <span className="text-sm font-medium text-indigo-600">{selectedLocation.addedBy}</span>
                      </div>

                      {selectedLocation.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {selectedLocation.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 text-sm text-indigo-700 rounded-full border border-indigo-100"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEditingLocation(selectedLocation);
                        setShowEditModal(true);
                        setShowBottomSheet(false);
                      }}
                      className="w-10 h-10 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full flex items-center justify-center border border-blue-100 mobile-button"
                    >
                      <FiEdit3 className="w-4 h-4 text-blue-600" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteLocation(selectedLocation.id)}
                      className="w-10 h-10 bg-gradient-to-r from-red-50 to-pink-50 rounded-full flex items-center justify-center border border-red-100 mobile-button"
                    >
                      <FiTrash2 className="w-4 h-4 text-red-600" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 개선된 장소 추가 모달 */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                className="w-full bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <FiPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">새 장소 추가</h2>
                      <p className="text-sm text-gray-600">특별한 장소를 공유해보세요</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddModal(false)}
                    className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mobile-button"
                  >
                    <FiX className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">장소명</label>
                    <input
                      type="text"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="어떤 장소인가요?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">주소</label>
                    <input
                      type="text"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="주소를 입력해주세요"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">카테고리</label>
                    <div className="grid grid-cols-2 gap-3">
                      {LOCATION_CATEGORIES.map((category) => (
                        <motion.button
                          key={category.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setNewLocation({...newLocation, category: category.id})}
                          className={`p-4 rounded-2xl border-2 transition-all mobile-button ${
                            newLocation.category === category.id
                              ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm`}>
                            <category.icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{category.name}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">설명 (선택사항)</label>
                    <textarea
                      value={newLocation.description}
                      onChange={(e) => setNewLocation({...newLocation, description: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                      placeholder="이 장소에 대해 설명해주세요"
                      rows={3}
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddLocation}
                    disabled={!newLocation.name || !newLocation.address}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-semibold disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg mobile-button"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <FiSave className="w-5 h-5" />
                      <span>장소 추가하기</span>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 개선된 장소 수정 모달 */}
        <AnimatePresence>
          {showEditModal && editingLocation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
              onClick={() => setShowEditModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                className="w-full bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <FiEdit3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">장소 수정</h2>
                      <p className="text-sm text-gray-600">장소 정보를 업데이트하세요</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowEditModal(false)}
                    className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mobile-button"
                  >
                    <FiX className="w-5 h-5 text-gray-600" />
                  </motion.button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">장소명</label>
                    <input
                      type="text"
                      value={editingLocation.name}
                      onChange={(e) => setEditingLocation({...editingLocation, name: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">주소</label>
                    <input
                      type="text"
                      value={editingLocation.address}
                      onChange={(e) => setEditingLocation({...editingLocation, address: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">설명</label>
                    <textarea
                      value={editingLocation.description || ''}
                      onChange={(e) => setEditingLocation({...editingLocation, description: e.target.value})}
                      className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEditLocation}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-2xl font-semibold transition-all shadow-lg mobile-button"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <FiSave className="w-5 h-5" />
                      <span>수정 완료</span>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default LocationPage; 