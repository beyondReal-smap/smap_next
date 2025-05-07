'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageContainer, Button } from '../components/layout';
import { FiPlus } from 'react-icons/fi';
import { API_KEYS, MAP_CONFIG } from '../../config'; 

// window 전역 객체에 naver 프로퍼티 타입 선언
declare global {
  interface Window {
    naver: any;
    // google: any; // google은 logs 페이지에서 아직 사용하지 않으므로 주석 처리 또는 필요시 추가
  }
}

const NAVER_MAPS_CLIENT_ID = API_KEYS.NAVER_MAPS_CLIENT_ID;

// --- home/page.tsx에서 가져온 인터페이스 및 데이터 시작 ---
interface Location { // home/page.tsx의 Location 인터페이스 (필요시 logs의 기존 LocationData와 병합/조정)
  lat: number;
  lng: number;
}

interface Schedule {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string;
  isSelected: boolean;
  location: Location; // 위에서 정의한 Location 사용
  schedules: Schedule[];
}

const MOCK_GROUP_MEMBERS_HOME: GroupMember[] = [
  { 
    id: 'h_gm_1', // ID 중복 방지를 위해 접두사 추가
    name: '김철수', 
    photo: '/images/avatar3.png', 
    isSelected: false,
    location: { lat: 37.5642 + 0.005, lng: 127.0016 + 0.002 },
    schedules: []
  },
  { 
    id: 'h_gm_2', 
    name: '이영희', 
    photo: '/images/avatar1.png', 
    isSelected: false,
    location: { lat: 37.5642 - 0.003, lng: 127.0016 - 0.005 },
    schedules: []
  },
  // 추가 멤버 필요 시 여기에...
];

const RECENT_SCHEDULES_HOME: Schedule[] = [
  { id: 'h_rs_1_log', title: '팀 미팅 (로그)', date: '오늘 14:00', location: '강남 사무실' },
  { id: 'h_rs_2_log', title: '프로젝트 발표 (로그)', date: '내일 10:00', location: '회의실 A' },
];
// --- home/page.tsx에서 가져온 인터페이스 및 데이터 끝 ---

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
  transform: translateY(calc(100% - 200px)); /* 예시 높이, 추후 조정 */
  height: 100vh;
}

.bottom-sheet-middle {
  transform: translateY(calc(100% - 40vh)); /* 예시 높이, 추후 조정 */
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

/* --- home/page.tsx 에서 가져온 스타일 추가 시작 --- */
.section-divider {
  height: 1px;
  background: #f2f2f2;
  margin: 16px 0;
  width: 100%;
}

.section-title {
  margin-bottom: 10px; 
  padding-bottom: 6px; 
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  color: #424242;
  font-weight: 600;
}

.content-section {
  padding: 10px 16px; 
  background-color: #ffffff;
  border-radius: 12px;
  margin-bottom: 10px; 
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

.members-section { /* home 스타일과 다른 색상 적용 가능 */
  background: linear-gradient(to right, rgba(79, 70, 229, 0.03), transparent); 
}

.members-section::before {
  background-color: #4F46E5; 
}

.schedule-section { /* home 스타일과 다른 색상 적용 가능 */
  background: linear-gradient(to right, rgba(20, 184, 166, 0.03), transparent); 
}

.schedule-section::before {
  background-color: #0D9488; 
}
/* --- home/page.tsx 에서 가져온 스타일 추가 끝 --- */
`;

export default function LogsPage() {
  const router = useRouter();
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(MOCK_GROUP_MEMBERS_HOME);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); 
  const memberNaverMarkers = useRef<any[]>([]); 
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true); 

  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'middle' | 'expanded'>('collapsed');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number | null>(null);
  const currentDragY = useRef<number | null>(null);
  const dragStartTime = useRef<number | null>(null);

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

  useEffect(() => {
    loadNaverMapsAPI();
  }, []);

  useEffect(() => {
    if (naverMapsLoaded && mapContainer.current && !map.current) {
      setIsMapLoading(true);
      try {
        const initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            ...MAP_CONFIG.NAVER.DEFAULT_OPTIONS,
            center: initialCenter,
            zoom: MAP_CONFIG.NAVER.DEFAULT_OPTIONS?.zoom || 10, 
            logoControl: false,
            mapDataControl: false,
        };
        map.current = new window.naver.maps.Map(mapContainer.current, mapOptions);
        window.naver.maps.Event.addListener(map.current, 'init', () => {
            console.log('Naver Map initialized for LogsPage');
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

  const getRecentDays = () => {
    return Array.from({ length: 8 }, (_, i) => {
      const date = subDays(new Date(), 7 - i); // 오늘부터 7일전까지 (오늘 포함 8일)
      return {
        value: format(date, 'yyyy-MM-dd'),
        display: i === 7 ? '오늘' : format(date, 'MM.dd (E)', { locale: ko })
      };
    });
  };

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

  const updateMemberMarkers = (members: GroupMember[]) => {
    if (!map.current || !window.naver?.maps || !naverMapsLoaded) return;
    memberNaverMarkers.current.forEach(marker => marker.setMap(null));
    memberNaverMarkers.current = [];
    const selectedMembers = members.filter(member => member.isSelected);
    selectedMembers.forEach(member => {
      const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
      const marker = new window.naver.maps.Marker({
        position: position, map: map.current,
        icon: { content: `<div style="position: relative; text-align: center;"><div style="width: 32px; height: 32px; background-color: white; border: 2px solid #4F46E5; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"><img src="${member.photo}" alt="${member.name}" style="width: 100%; height: 100%; object-fit: cover;" /></div><div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 2px 5px; border-radius: 3px; white-space: nowrap; font-size: 10px;">${member.name}</div></div>`, size: new window.naver.maps.Size(36, 48), anchor: new window.naver.maps.Point(18, 42) }, zIndex: 150
      });
      memberNaverMarkers.current.push(marker);
    });
    if (selectedMembers.length === 1) {
      const member = selectedMembers[0];
      if (map.current && member.location) {
        const position = new window.naver.maps.LatLng(member.location.lat, member.location.lng);
        map.current.panTo(position);
        if (map.current.getZoom() < 14) map.current.setZoom(14); // Zoom 레벨 조정
      }
    } else if (selectedMembers.length > 1) {
      const bounds = new window.naver.maps.LatLngBounds();
      selectedMembers.forEach(member => {
        if (member.location) bounds.extend(new window.naver.maps.LatLng(member.location.lat, member.location.lng));
      });
      if (!bounds.isEmpty()) map.current.fitBounds(bounds);
    }
  };

  const handleMemberSelect = (id: string) => {
    const updatedMembers = groupMembers.map(member => member.id === id ? { ...member, isSelected: !member.isSelected } : { ...member, isSelected: false });
    setGroupMembers(updatedMembers);
    updateMemberMarkers(updatedMembers);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // 이 날짜를 기준으로 실제 데이터 필터링/로딩 로직은 현재 없음
  };

  useEffect(() => {
    if (naverMapsLoaded && map.current && groupMembers.length > 0) {
      if (!groupMembers.some(m => m.isSelected)) { handleMemberSelect(groupMembers[0].id); }
    }
  }, [naverMapsLoaded, map.current, groupMembers]);

  return (
    <>
      <style jsx global>{pageStyles}</style>
      <PageContainer title="활동 로그" showHeader={false} showBackButton={false} className="p-0 m-0 w-full h-screen overflow-hidden">
        {isMapLoading && ( <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-50"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div> </div> )}
        <div className="full-map-container"><div ref={mapContainer} className="w-full h-full" /></div>

        <div ref={bottomSheetRef} className={`bottom-sheet ${getBottomSheetClassName()} hide-scrollbar`}>
          <div className="bottom-sheet-handle" onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd} onClick={toggleBottomSheet}></div>
          
          <div className="px-4 pb-4">
            <div className="content-section members-section">
              <h2 className="text-lg font-medium text-gray-900 flex justify-between items-center section-title">
                그룹 멤버
                <Link href="/group" className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <FiPlus className="h-3 w-3 mr-1" />그룹 관리
                </Link>
              </h2>
              {groupMembers.length > 0 ? (
                <div className="flex flex-row flex-nowrap justify-start items-center gap-x-4 mb-2 overflow-x-auto hide-scrollbar px-2 py-2">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex flex-col items-center p-0 flex-shrink-0">
                      <button onClick={() => handleMemberSelect(member.id)} className={`flex flex-col items-center focus:outline-none`}>
                        <div className={`w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 ${member.isSelected ? 'border-indigo-500 ring-2 ring-indigo-300 scale-110' : 'border-transparent'}`}>
                          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                        </div>
                        <span className={`block text-xs font-medium mt-1.5 ${member.isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{member.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3 text-gray-500"><p>그룹에 참여한 멤버가 없습니다</p></div>
              )}
              <div className="mt-3 mb-1 overflow-x-auto pb-2 hide-scrollbar">
                {getRecentDays().map((day, idx) => (
                  <button key={idx} onClick={() => handleDateSelect(day.value)}
                    className={`px-3 py-2 rounded-lg flex-shrink-0 focus:outline-none transition-colors ${selectedDate === day.value ? 'bg-gray-900 text-white font-medium shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-center"><div className="text-xs">{day.display}</div></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
} 