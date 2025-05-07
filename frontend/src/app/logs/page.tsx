'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '../components/layout';
// Naver Maps 관련 설정 추가 (location/page.tsx 참고)
import { API_KEYS, MAP_CONFIG } from '../../config'; 

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
  }
}

const NAVER_MAPS_CLIENT_ID = API_KEYS.NAVER_MAPS_CLIENT_ID;

// 모의 로그 데이터
const MOCK_LOGS = [
  {
    id: '1',
    type: 'schedule',
    action: 'create',
    title: '팀 미팅 일정이 생성되었습니다.',
    description: '9월 15일 오후 2시 - 강남 사무실',
    user: '김철수',
    timestamp: '2023-09-10T14:32:00',
  },
  {
    id: '2',
    type: 'location',
    action: 'update',
    title: '장소 정보가 업데이트되었습니다.',
    description: '강남 사무실 - 주소 변경',
    user: '이영희',
    timestamp: '2023-09-09T11:15:00',
  },
  {
    id: '3',
    type: 'group',
    action: 'add_member',
    title: '그룹원이 추가되었습니다.',
    description: '개발팀 - 박지민 추가',
    user: '김철수',
    timestamp: '2023-09-08T16:45:00',
  },
  {
    id: '4',
    type: 'schedule',
    action: 'delete',
    title: '일정이 취소되었습니다.',
    description: '9월 12일 프로젝트 중간점검 - 취소',
    user: '이영희',
    timestamp: '2023-09-07T09:20:00',
  },
  {
    id: '5',
    type: 'location',
    action: 'create',
    title: '새 장소가 등록되었습니다.',
    description: '을지로 오피스 - 추가됨',
    user: '김철수',
    timestamp: '2023-09-06T13:10:00',
  },
  {
    id: '6',
    type: 'group',
    action: 'remove_member',
    title: '그룹원이 제거되었습니다.',
    description: '마케팅팀 - 홍길동 제거',
    user: '정민지',
    timestamp: '2023-09-05T15:30:00',
  },
  {
    id: '7',
    type: 'schedule',
    action: 'update',
    title: '일정이 수정되었습니다.',
    description: '9월 20일 고객 미팅 - 시간 변경',
    user: '이영희',
    timestamp: '2023-09-04T10:25:00',
  }
];

// pageStyles 복사 (location/page.tsx와 동일하게)
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
  transform: translateY(calc(100% - 220px)); /* 로그 페이지는 기본 높이를 조금 더 확보 */
  height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(calc(100% - 50vh)); /* 중간 높이 50vh */
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

/* z-index는 location/page.tsx와 동일하게 유지 (모달 등 다른 요소 고려) */
.modal-overlay {
  z-index: 50;
}
.modal-content {
  z-index: 51;
}
`;

export default function LogsPage() {
  // 기존 로그 관련 상태
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [filteredLogs, setFilteredLogs] = useState(MOCK_LOGS);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // 지도 및 바텀시트 관련 상태 및 Ref (location/page.tsx 참고)
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); // Naver Map 인스턴스
  const markers = useRef<{ [key: string]: any }>({}); // Naver Marker 인스턴스
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); // 지도 로딩 상태

  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'middle' | 'expanded'>('collapsed');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const currentDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);

  // Naver Maps API 로드 함수 (location/page.tsx와 동일)
  const loadNaverMapsAPI = () => {
    if (window.naver?.maps) {
      setNaverMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'naver-maps-script-logs'; // 스크립트 ID 변경 (다른 페이지와 충돌 방지)
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_MAPS_CLIENT_ID}&submodules=geocoder,drawing,visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Naver Maps API loaded for LogsPage.');
      setNaverMapsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Naver Maps API for LogsPage.');
      setIsMapLoading(false);
    };
    const existingScript = document.getElementById('naver-maps-script-logs');
    if (!existingScript) {
      document.head.appendChild(script);
    }
  };

  // 지도 초기화 useEffect (location/page.tsx와 유사)
  useEffect(() => {
    loadNaverMapsAPI();
  }, []);

  useEffect(() => {
    if (naverMapsLoaded && mapContainer.current && !map.current) {
      setIsMapLoading(true);
      try {
        // 로그 페이지의 초기 지도 중심 (서울 시청 근처)
        const initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
            center: initialCenter,
            zoom: MAP_CONFIG.NAVER.DEFAULT_OPTIONS?.zoom || 10, // 로그는 넓은 범위로 시작
            logoControl: false,
            mapDataControl: false,
        };
        map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);
        window.naver.maps.Event.addListener(map.current, 'init', () => {
            console.log('Naver Map initialized for LogsPage');
            // addMarkersToMapForLogs(); // 로그용 마커 함수 (추후 구현)
            setIsMapLoading(false);
            if(map.current) map.current.refresh(true);
        });
      } catch (error) {
        console.error('Naver Maps 초기화 중 오류(LogsPage):', error);
        setIsMapLoading(false);
      }
    }
    return () => {
      if (map.current && typeof map.current.destroy === 'function') {
         map.current.destroy();
      }
      map.current = null;
    };
  }, [naverMapsLoaded]);

  // 기존 로그 필터링 useEffect (유지)
  useEffect(() => {
    let filtered = logs;
    if (selectedType !== 'all') {
      filtered = filtered.filter(log => log.type === selectedType);
    }
    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredLogs(filtered);
    // 지도와 연동된 마커 업데이트 (추후 구현)
    // if (map.current && window.naver?.maps && naverMapsLoaded) {
    //     updateLogMarkers(filtered);
    // }
  }, [logs, selectedType, searchQuery, naverMapsLoaded]);

  // 바텀시트 핸들러 함수들 (location/page.tsx와 동일)
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
    const collapsedY = window.innerHeight - 220; // 바텀시트 collapsed 높이 반영
    newTranslateY = Math.max(expandedY - (window.innerHeight * 0.1), Math.min(newTranslateY, collapsedY + 50));
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
    const middleThresholdClose = windowHeight * 0.6; // 중간 닫힘 기준 조정 (50vh)

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

  // 기존 로그 관련 함수 (유지)
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  const getLogTypeStyles = (type: string) => {
    switch(type) {
      case 'schedule':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600'
        };
      case 'location':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          ),
          bgColor: 'bg-green-100',
          textColor: 'text-green-600'
        };
      case 'group':
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-600'
        };
      default:
        return {
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600'
        };
    }
  };

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <PageContainer title="활동 로그" showHeader={false} showBackButton={false} className="p-0 m-0 w-full h-screen overflow-hidden">
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

          {/* 바텀시트 내용: 기존 로그 필터 및 목록 */}
          <div className="px-4 pb-4">
            {/* 필터 및 검색 (기존 UI 유지) */}
            <div className="bg-white p-4 rounded-xl shadow-md mb-6 sticky top-0 z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">활동 로그</h2> {/* 바텀시트용 헤더 추가 */} 
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-auto">
                  <select
                    className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value="all">전체 유형</option>
                    <option value="schedule">일정</option>
                    <option value="location">장소</option>
                    <option value="group">그룹</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="검색..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 로그 목록 (스크롤 영역 높이 조절) */}
            <div 
              className="overflow-y-auto"
              style={{
                maxHeight: bottomSheetState === 'expanded' 
                  ? 'calc(90vh - 180px)' // 확장 시 (핸들 + 필터 영역 높이 고려)
                  : bottomSheetState === 'middle'
                  ? 'calc(50vh - 150px)' // 중간 시
                  : 'calc(220px - 150px)'   // 축소 시 (최소 높이)
              }}
            >
              {filteredLogs.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredLogs.map(log => {
                    const { icon, bgColor, textColor } = getLogTypeStyles(log.type);
                    return (
                      <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start">
                          <div className={`flex-shrink-0 rounded-md p-2 ${bgColor} ${textColor}`}>
                            {icon}
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="flex justify-between items-start">
                              <h3 className="text-sm font-medium text-gray-900">{log.title}</h3>
                              <span className="text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(log.timestamp)}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 break-all">{log.description}</p>
                            <div className="mt-2 text-xs text-gray-500">
                              <span>작업자: {log.user}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>표시할 로그가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
} 