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
  FiShoppingBag
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

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

// 카테고리 정의
const LOCATION_CATEGORIES = [
  { id: 'restaurant', name: '맛집', icon: FiCoffee, color: '#ef4444' },
  { id: 'shopping', name: '쇼핑', icon: FiShoppingBag, color: '#f59e0b' },
  { id: 'attraction', name: '관광지', icon: FiStar, color: '#10b981' },
  { id: 'accommodation', name: '숙박', icon: FiHome, color: '#3b82f6' },
  { id: 'favorite', name: '즐겨찾기', icon: FiHeart, color: '#ec4899' },
  { id: 'other', name: '기타', icon: FiMapPin, color: '#6b7280' }
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
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    category: 'restaurant',
    description: '',
    tags: [] as string[],
    rating: 0
  });

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
      const markerSize = isSelected ? 40 : 30;

      return (
        <Marker
          key={location.id}
          position={{ lat: location.latitude, lng: location.longitude }}
          onClick={() => handleMarkerClick(location)}
          icon={{
            url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 24 24" fill="${markerColor}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 z-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FiMapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">우리의 장소</h1>
              <p className="text-xs text-gray-500">{filteredLocations.length}개의 장소</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <FiPlus className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        {/* 검색 및 필터 */}
        <div className="mt-3 space-y-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="장소 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-1">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              전체
            </motion.button>
            {LOCATION_CATEGORIES.map((category) => (
              <motion.button
                key={category.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.id 
                    ? 'text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}
                style={{
                  backgroundColor: selectedCategory === category.id ? category.color : undefined
                }}
              >
                {category.name}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 지도 */}
      <div className="flex-1 relative">
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
              <div className="p-2 max-w-xs">
                <h3 className="font-bold text-sm">{selectedLocation.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{selectedLocation.address}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* 플로팅 버튼들 */}
        <div className="absolute bottom-4 right-4 space-y-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={moveToCurrentLocation}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center"
          >
            <FiNavigation className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>
      </div>

      {/* 하단 시트 */}
      <AnimatePresence>
        {showBottomSheet && selectedLocation && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20"
          >
            <div className="p-4">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{selectedLocation.name}</h3>
                    {selectedLocation.rating && (
                      <div className="flex items-center space-x-1">
                        <FiStar className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600">{selectedLocation.rating}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{selectedLocation.address}</p>
                  {selectedLocation.description && (
                    <p className="text-sm text-gray-800 mb-3">{selectedLocation.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xs text-gray-500">추가한 사람:</span>
                    <span className="text-xs font-medium text-indigo-600">{selectedLocation.addedBy}</span>
                  </div>

                  {selectedLocation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {selectedLocation.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 ml-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setEditingLocation(selectedLocation);
                      setShowEditModal(true);
                      setShowBottomSheet(false);
                    }}
                    className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                  >
                    <FiEdit3 className="w-4 h-4 text-gray-600" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDeleteLocation(selectedLocation.id)}
                    className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"
                  >
                    <FiTrash2 className="w-4 h-4 text-red-600" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 추가 모달 */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
              className="w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">새 장소 추가</h2>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  <FiX className="w-4 h-4 text-gray-600" />
                </motion.button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">장소명</label>
                  <input
                    type="text"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="장소명을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
                  <input
                    type="text"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="주소를 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LOCATION_CATEGORIES.map((category) => (
                      <motion.button
                        key={category.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setNewLocation({...newLocation, category: category.id})}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          newLocation.category === category.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <category.icon className="w-5 h-5 mx-auto mb-1" style={{ color: category.color }} />
                        <span className="text-xs font-medium">{category.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명 (선택)</label>
                  <textarea
                    value={newLocation.description}
                    onChange={(e) => setNewLocation({...newLocation, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="장소에 대한 설명을 입력하세요"
                    rows={3}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddLocation}
                  disabled={!newLocation.name || !newLocation.address}
                  className="w-full bg-indigo-500 text-white py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiSave className="w-4 h-4" />
                    <span>장소 추가</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 수정 모달 */}
      <AnimatePresence>
        {showEditModal && editingLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
              className="w-full bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">장소 수정</h2>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowEditModal(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  <FiX className="w-4 h-4 text-gray-600" />
                </motion.button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">장소명</label>
                  <input
                    type="text"
                    value={editingLocation.name}
                    onChange={(e) => setEditingLocation({...editingLocation, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
                  <input
                    type="text"
                    value={editingLocation.address}
                    onChange={(e) => setEditingLocation({...editingLocation, address: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    value={editingLocation.description || ''}
                    onChange={(e) => setEditingLocation({...editingLocation, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEditLocation}
                  className="w-full bg-indigo-500 text-white py-3 rounded-lg font-medium transition-all"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <FiSave className="w-4 h-4" />
                    <span>수정 완료</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocationPage; 