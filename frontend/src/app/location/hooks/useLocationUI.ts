'use client';

import { useState, useCallback } from 'react';

interface UseLocationUIProps {
  onMemberSelect: (memberId: string, openLocationPanel?: boolean, membersArray?: any[], fromMarkerClick?: boolean, clickedMarker?: any, onlyShowInfoWindow?: boolean) => void;
  onLocationSelect: (location: any) => void;
}

export const useLocationUI = ({ onMemberSelect, onLocationSelect }: UseLocationUIProps) => {
  // 사이드바 상태
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  
  // 패널 상태
  const [isLocationInfoPanelOpen, setIsLocationInfoPanelOpen] = useState(false);
  const [isEditingPanel, setIsEditingPanel] = useState(false);
  
  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
  } | null>(null);
  
  // 장소 삭제 모달 상태
  const [isLocationDeleteModalOpen, setIsLocationDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<any | null>(null);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  
  // 토스트 모달 상태
  const [toastModal, setToastModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'loading';
    title: string;
    message: string;
    progress?: number;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    progress: 0,
    autoClose: true
  });
  
  // 뷰 상태
  const [activeView, setActiveView] = useState<'selectedMemberPlaces' | 'otherMembersPlaces'>('selectedMemberPlaces');
  
  // 드래그 및 스와이프 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [swipeThreshold] = useState(50);
  
  // 검색 상태
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isSearchingLocationForPanel, setIsSearchingLocationForPanel] = useState(false);
  const [locationSearchModalCaller, setLocationSearchModalCaller] = useState<'panel' | 'modal' | null>(null);
  
  // 새 장소 입력 상태
  const [newLocation, setNewLocation] = useState<any>({
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
  
  // 선택된 장소 상태
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  
  // 사이드바 토글
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);
  
  // 그룹 선택기 토글
  const toggleGroupSelector = useCallback(() => {
    setIsGroupSelectorOpen(prev => !prev);
  }, []);
  
  // 그룹 선택기 열기
  const openGroupSelector = useCallback(() => {
    setIsGroupSelectorOpen(true);
  }, []);
  
  // 그룹 선택기 닫기
  const closeGroupSelector = useCallback(() => {
    setIsGroupSelectorOpen(false);
  }, []);
  
  // 위치 정보 패널 열기
  const openLocationInfoPanel = useCallback(() => {
    setIsLocationInfoPanelOpen(true);
    setIsEditingPanel(false);
  }, []);
  
  // 위치 정보 패널 닫기
  const closeLocationInfoPanel = useCallback(() => {
    setIsLocationInfoPanelOpen(false);
    setIsEditingPanel(false);
  }, []);
  
  // 편집 패널 열기
  const openEditingPanel = useCallback(() => {
    setIsEditingPanel(true);
  }, []);
  
  // 편집 패널 닫기
  const closeEditingPanel = useCallback(() => {
    setIsEditingPanel(false);
  }, []);
  
  // 모달 열기
  const openModal = useCallback((
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info', 
    onConfirmCallback?: () => void,
    autoClose?: boolean
  ) => {
    setModalContent({ title, message, type, onConfirm: onConfirmCallback });
    setIsModalOpen(true);
    
    if (autoClose && !onConfirmCallback) {
      setTimeout(() => {
        closeModal();
      }, 3000);
    }
  }, []);
  
  // 모달 닫기
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);
  
  // 토스트 모달 표시
  const showToastModal = useCallback((
    type: 'success' | 'error' | 'loading',
    title: string,
    message: string,
    autoClose: boolean = true,
    duration: number = 3000
  ) => {
    setToastModal({
      isOpen: true,
      type,
      title,
      message,
      progress: 0,
      autoClose
    });

    if (autoClose && type !== 'loading') {
      let progress = 0;
      const interval = setInterval(() => {
        progress += (100 / duration) * 50;
        if (progress >= 100) {
          clearInterval(interval);
          setToastModal(prev => ({ ...prev, isOpen: false }));
        } else {
          setToastModal(prev => ({ ...prev, progress }));
        }
      }, 50);
    }
  }, []);
  
  // 토스트 모달 숨기기
  const hideToastModal = useCallback(() => {
    setToastModal(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  // 장소 삭제 모달 열기
  const openLocationDeleteModal = useCallback((location: any) => {
    setLocationToDelete(location);
    setIsLocationDeleteModalOpen(true);
  }, []);
  
  // 장소 삭제 모달 닫기
  const closeLocationDeleteModal = useCallback(() => {
    if (!isDeletingLocation) {
      setLocationToDelete(null);
      setIsLocationDeleteModalOpen(false);
    }
  }, [isDeletingLocation]);
  
  // 뷰 변경
  const handleViewChange = useCallback((view: 'selectedMemberPlaces' | 'otherMembersPlaces') => {
    console.log('[handleViewChange] 뷰 변경:', view);
    setActiveView(view);
  }, []);
  
  // 드래그 시작
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    setIsDragging(true);
    setDragStartY(clientY);
    setDragCurrentY(clientY);
    setSwipeStartX(clientX);
    setIsHorizontalSwipe(false);
    
    (e.target as any)._startedAt = performance.now();
  }, []);
  
  // 드래그 이동
  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    const deltaX = clientX - swipeStartX;
    const deltaY = clientY - dragStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const directionThreshold = 8;

    if (isHorizontalSwipe === false && absDeltaX > directionThreshold && absDeltaX > absDeltaY) {
      setIsHorizontalSwipe(true);
      console.log('[DragMove] 가로 스와이프 감지');
    } else if (isHorizontalSwipe === false && absDeltaY > directionThreshold && absDeltaY > absDeltaX) {
      setIsHorizontalSwipe(false);
      console.log('[DragMove] 세로 드래그 감지');
    }

    if (!isHorizontalSwipe) {
      setDragCurrentY(clientY);
    }
  }, [isDragging, isHorizontalSwipe, swipeStartX, dragStartY]);
  
  // 드래그 종료
  const handleDragEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;

    const swipeDeltaX = clientX - swipeStartX;
    const dragDeltaY = clientY - dragStartY;

    const swipeThresholdEnd = 60;
    const dragThresholdEnd = 15;
    const velocityThreshold = 0.2;

    const startTime = (e.target as any)._startedAt || performance.now() - 200;
    const duration = performance.now() - startTime;
    const velocityX = duration > 0 ? Math.abs(swipeDeltaX) / duration : 0;
    const velocityY = duration > 0 ? Math.abs(dragDeltaY) / duration : 0;

    console.log('[DragEnd] isHorizontalSwipe:', isHorizontalSwipe, 'swipeDeltaX:', swipeDeltaX, 'dragDeltaY:', dragDeltaY, 'velocityX:', velocityX, 'velocityY:', velocityY);

    if (isHorizontalSwipe === true) {
      console.log('[DragEnd] 가로 스와이프 처리');
      if (Math.abs(swipeDeltaX) > swipeThresholdEnd || velocityX > velocityThreshold) {
        if (swipeDeltaX > 0) {
          console.log('[DragEnd] 오른쪽 스와이프 감지 -> selectedMemberPlaces');
          handleViewChange('selectedMemberPlaces');
        } else {
          console.log('[DragEnd] 왼쪽 스와이프 감지 -> otherMembersPlaces');
          handleViewChange('otherMembersPlaces');
        }
        
        try {
          if ('vibrate' in navigator) { 
            navigator.vibrate([50, 10, 30]);
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
      } else {
        console.log('[DragEnd] 가로 스와이프 임계값 미달 -> 현재 뷰 유지');
        handleViewChange(activeView);
      }
    } else {
      console.log('[DragEnd] 세로 드래그 처리');
      const triggerHaptic = () => {
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([20, 5, 15]);
          }
        } catch (error) {
          console.debug('햅틱 피드백이 차단되었습니다:', error);
        }
      };

      console.log('[DragEnd] 드래그 완료');
    }
    
    (e.target as any)._startedAt = 0;
  }, [isDragging, isHorizontalSwipe, swipeStartX, dragStartY, handleViewChange, activeView]);
  
  // 새 장소 입력 초기화
  const resetNewLocation = useCallback(() => {
    setNewLocation({
      name: '',
      address: '',
      coordinates: [0, 0],
      category: '기타',
      memo: '',
      favorite: false,
      notifications: true
    });
    setClickedCoordinates(null);
  }, []);
  
  // 검색 결과 초기화
  const clearSearchResults = useCallback(() => {
    setLocationSearchResults([]);
    setLocationSearchQuery('');
    setLocationSearchModalCaller(null);
  }, []);
  
  return {
    // 사이드바 상태
    isSidebarOpen,
    isGroupSelectorOpen,
    
    // 패널 상태
    isLocationInfoPanelOpen,
    isEditingPanel,
    
    // 모달 상태
    isModalOpen,
    modalContent,
    isLocationDeleteModalOpen,
    locationToDelete,
    isDeletingLocation,
    
    // 토스트 상태
    toastModal,
    
    // 뷰 상태
    activeView,
    
    // 드래그 상태
    isDragging,
    dragStartY,
    dragCurrentY,
    isHorizontalSwipe,
    swipeStartX,
    swipeThreshold,
    
    // 검색 상태
    locationSearchQuery,
    locationSearchResults,
    isSearchingLocationForPanel,
    locationSearchModalCaller,
    
    // 새 장소 상태
    newLocation,
    clickedCoordinates,
    isSavingLocationPanel,
    
    // 선택된 장소 상태
    selectedLocationId,
    
    // 사이드바 함수
    toggleSidebar,
    setIsSidebarOpen,
    
    // 그룹 선택기 함수
    toggleGroupSelector,
    openGroupSelector,
    closeGroupSelector,
    setIsGroupSelectorOpen,
    
    // 패널 함수
    openLocationInfoPanel,
    closeLocationInfoPanel,
    openEditingPanel,
    closeEditingPanel,
    setIsLocationInfoPanelOpen,
    setIsEditingPanel,
    
    // 모달 함수
    openModal,
    closeModal,
    openLocationDeleteModal,
    closeLocationDeleteModal,
    setIsModalOpen,
    setModalContent,
    setIsLocationDeleteModalOpen,
    setLocationToDelete,
    setIsDeletingLocation,
    
    // 토스트 함수
    showToastModal,
    hideToastModal,
    setToastModal,
    
    // 뷰 함수
    handleViewChange,
    setActiveView,
    
    // 드래그 함수
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    setIsDragging,
    setDragStartY,
    setDragCurrentY,
    setIsHorizontalSwipe,
    setSwipeStartX,
    
    // 검색 함수
    setLocationSearchQuery,
    setLocationSearchResults,
    setIsSearchingLocationForPanel,
    setLocationSearchModalCaller,
    clearSearchResults,
    
    // 새 장소 함수
    setNewLocation,
    setClickedCoordinates,
    setIsSavingLocationPanel,
    resetNewLocation,
    
    // 선택된 장소 함수
    setSelectedLocationId
  };
};
