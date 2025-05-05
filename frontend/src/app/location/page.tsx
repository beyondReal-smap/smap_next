'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiMapPin } from 'react-icons/fi';

// Mapbox 토큰 설정
mapboxgl.accessToken = 'pk.eyJ1Ijoic21hcHVzZXIiLCJhIjoiY2xuMnJ5cDN5MGE3dzJrcGR0ZnY1dXRweSJ9.JWqim9aXdkPOeQI7GbyBqA';

// 모의 위치 데이터
const MOCK_LOCATIONS = [
  {
    id: '1',
    name: '본사 사무실',
    address: '서울시 강남구 테헤란로 123',
    category: '회사',
    coordinates: [127.0381, 37.5012], // [경도, 위도]
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

// 카테고리 선택 옵션
const CATEGORY_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '회사', label: '회사' },
  { value: '미팅장소', label: '미팅장소' },
  { value: '식당', label: '식당' },
  { value: '카페', label: '카페' },
  { value: '기타', label: '기타' }
];

export default function LocationPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const [locations, setLocations] = useState(MOCK_LOCATIONS);
  const [filteredLocations, setFilteredLocations] = useState(MOCK_LOCATIONS);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    category: '회사',
    coordinates: [127.0000, 37.5000], // 기본값: 서울 중심
    memo: '',
    favorite: false
  });

  // Mapbox 초기화
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [127.0016, 37.5642], // 서울 중심
        zoom: 11
      });

      // 줌 및 내비게이션 컨트롤 추가
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // 맵 로드 완료 후 마커 추가
      map.current.on('load', () => {
        addMarkersToMap();
      });
    }

    // 컴포넌트 언마운트 시 맵 제거
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 위치 목록 필터링
  useEffect(() => {
    let filtered = locations;
    
    // 카테고리 필터링
    if (selectedCategory !== '전체') {
      filtered = filtered.filter(loc => loc.category === selectedCategory);
    }
    
    // 검색어 필터링
    if (searchQuery) {
      filtered = filtered.filter(loc => 
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        loc.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredLocations(filtered);
    
    // 마커 업데이트
    if (map.current && map.current.loaded()) {
      updateMarkers(filtered);
    }
  }, [locations, selectedCategory, searchQuery]);

  // 마커 추가
  const addMarkersToMap = () => {
    if (!map.current) return;
    
    // 기존 마커 모두 제거
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};
    
    // 필터링된 위치에 마커 추가
    filteredLocations.forEach(location => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundImage = `url('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png')`;
      el.style.backgroundSize = 'cover';
      el.style.cursor = 'pointer';
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat(location.coordinates as [number, number])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3 class="font-bold">${location.name}</h3>
             <p>${location.address}</p>`
          )
        );
      
      if (map.current) {
        marker.addTo(map.current);
      }
      
      // 마커 클릭 시 해당 위치 선택
      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });
      
      markers.current[location.id] = marker;
    });
  };

  // 마커 업데이트
  const updateMarkers = (locations: any[]) => {
    if (!map.current) return;
    
    // 기존 마커 모두 제거
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};
    
    // 새 마커 추가
    locations.forEach(location => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundImage = `url('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png')`;
      el.style.backgroundSize = 'cover';
      el.style.cursor = 'pointer';
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat(location.coordinates as [number, number])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<h3 class="font-bold">${location.name}</h3>
             <p>${location.address}</p>`
          )
        );
      
      if (map.current) {
        marker.addTo(map.current);
      }
      
      // 마커 클릭 이벤트
      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });
      
      markers.current[location.id] = marker;
    });
  };

  // 위치 선택
  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    
    // 선택된 위치로 지도 이동
    if (map.current) {
      map.current.flyTo({
        center: location.coordinates,
        zoom: 15,
        essential: true
      });
      
      // 해당 마커의 팝업 표시
      markers.current[location.id]?.togglePopup();
    }
  };

  // 새 위치 추가
  const handleAddLocation = () => {
    const locationToAdd = {
      id: String(locations.length + 1),
      ...newLocation
    };
    
    // 실제 구현 시에는 API에 저장합니다
    /*
    axios.post('/api/locations', locationToAdd)
      .then(response => {
        if (response.data.success) {
          setLocations([...locations, locationToAdd]);
          setIsAddModalOpen(false);
          setNewLocation({
            name: '',
            address: '',
            category: '회사',
            coordinates: [127.0000, 37.5000],
            memo: '',
            favorite: false
          });
        }
      })
      .catch(error => {
        console.error('위치 추가 중 오류가 발생했습니다.', error);
      });
    */
    
    // 모의 데이터 저장 (API 연동 전 테스트용)
    setLocations([...locations, locationToAdd]);
    setIsAddModalOpen(false);
    setNewLocation({
      name: '',
      address: '',
      category: '회사',
      coordinates: [127.0000, 37.5000],
      memo: '',
      favorite: false
    });
  };

  // 위치 삭제
  const handleDeleteLocation = (id: string) => {
    // 실제 구현 시에는 API에서 삭제합니다
    /*
    axios.delete(`/api/locations/${id}`)
      .then(response => {
        if (response.data.success) {
          setLocations(locations.filter(loc => loc.id !== id));
          setSelectedLocation(null);
        }
      })
      .catch(error => {
        console.error('위치 삭제 중 오류가 발생했습니다.', error);
      });
    */
    
    // 모의 데이터 삭제 (API 연동 전 테스트용)
    setLocations(locations.filter(loc => loc.id !== id));
    setSelectedLocation(null);
  };

  // 즐겨찾기 토글
  const handleToggleFavorite = (id: string) => {
    // 실제 구현 시에는 API에 업데이트합니다
    /*
    const location = locations.find(loc => loc.id === id);
    if (!location) return;
    
    axios.patch(`/api/locations/${id}`, { favorite: !location.favorite })
      .then(response => {
        if (response.data.success) {
          setLocations(locations.map(loc => 
            loc.id === id ? { ...loc, favorite: !loc.favorite } : loc
          ));
        }
      })
      .catch(error => {
        console.error('즐겨찾기 업데이트 중 오류가 발생했습니다.', error);
      });
    */
    
    // 모의 데이터 업데이트 (API 연동 전 테스트용)
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, favorite: !loc.favorite } : loc
    ));
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-suite">위치 관리</h1>
        <p className="mt-2 text-gray-600">저장된 위치를 관리하고 일정에 활용하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 위치 목록 패널 */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-md h-[calc(100vh-200px)] flex flex-col">
          {/* 검색 및 필터 */}
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

          {/* 위치 목록 */}
          <div className="flex-1 overflow-y-auto">
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
                    onClick={() => handleLocationSelect(location)}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-1">
                        <FiMapPin className={`${location.favorite ? 'text-indigo-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900">{location.name}</h3>
                          <button 
                            className="text-gray-400 hover:text-indigo-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(location.id);
                            }}
                          >
                            {location.favorite ? (
                              <svg className="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 01.774.37l2.453 3.5A1 1 0 0113.6 7H9.4a1 1 0 01-.374-.069L6.226 2.37A1 1 0 017 2h3zm-4 9a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
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

          {/* 새 위치 추가 버튼 */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FiPlus className="mr-2" />
              새 위치 추가
            </button>
          </div>
        </div>

        {/* 지도 영역 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden h-[calc(100vh-200px)]">
          <div 
            ref={mapContainer} 
            className="w-full h-full"
          />
        </div>
      </div>

      {/* 선택된 위치 상세 정보 */}
      {selectedLocation && (
        <div className="mt-6 bg-white p-5 rounded-xl shadow-md">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-semibold text-gray-900 font-suite">{selectedLocation.name}</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setNewLocation(selectedLocation);
                  setIsEditModalOpen(true);
                }}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600"
              >
                <FiEdit2 />
              </button>
              <button
                onClick={() => handleDeleteLocation(selectedLocation.id)}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600"
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
          
          <div className="mt-4 space-y-4">
            <div className="flex">
              <div className="w-24 flex-shrink-0 text-gray-500 text-sm">카테고리</div>
              <div className="text-sm">{selectedLocation.category}</div>
            </div>
            <div className="flex">
              <div className="w-24 flex-shrink-0 text-gray-500 text-sm">주소</div>
              <div className="text-sm">{selectedLocation.address}</div>
            </div>
            <div className="flex">
              <div className="w-24 flex-shrink-0 text-gray-500 text-sm">좌표</div>
              <div className="text-sm">
                위도: {selectedLocation.coordinates[1].toFixed(6)}, 
                경도: {selectedLocation.coordinates[0].toFixed(6)}
              </div>
            </div>
            {selectedLocation.memo && (
              <div className="flex">
                <div className="w-24 flex-shrink-0 text-gray-500 text-sm">메모</div>
                <div className="text-sm">{selectedLocation.memo}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 새 위치 추가 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium text-gray-900 font-suite">새 위치 추가</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                <input
                  type="text"
                  id="location-address"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                  required
                />
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
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 위치 편집 모달 - 실제 구현 시에는 isEditModalOpen 조건 추가 */}
    </div>
  );
} 