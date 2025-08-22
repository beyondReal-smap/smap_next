'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LocationMap } from './components/LocationMap';
import { LocationSidebar } from './components/LocationSidebar';
import { LocationInfoPanel } from './components/LocationInfoPanel';
import { Modal, LocationDeleteModal, ToastModal } from './components/LocationModals';
import { useLocationData } from './hooks/useLocationData';
import { useLocationUI, LocationData } from './hooks/useLocationUI';
import { validateLocationData, normalizeLocationData } from './utils/locationUtils';

export default function LocationPage() {
  // 기본 상태
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  // 데이터 관리 훅
  const {
    groupMembers,
    selectedMember,
    otherMembersLocations,
    selectedMemberLocations,
    isLoading,
    error,
    refreshData,
    saveLocation,
    deleteLocation,
    updateLocation
  } = useLocationData();

  // UI 상태 관리 훅
  const {
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
    
    // 함수들
    toggleSidebar,
    setIsSidebarOpen,
    toggleGroupSelector,
    openGroupSelector,
    closeGroupSelector,
    setIsGroupSelectorOpen,
    openLocationInfoPanel,
    closeLocationInfoPanel,
    openEditingPanel,
    closeEditingPanel,
    setIsLocationInfoPanelOpen,
    setIsEditingPanel,
    openModal,
    closeModal,
    openLocationDeleteModal,
    closeLocationDeleteModal,
    setIsModalOpen,
    setModalContent,
    setIsLocationDeleteModalOpen,
    setLocationToDelete,
    setIsDeletingLocation,
    showToastModal,
    hideToastModal,
    setToastModal,
    handleViewChange,
    setActiveView,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    setIsDragging,
    setDragStartY,
    setDragCurrentY,
    setIsHorizontalSwipe,
    setSwipeStartX,
    setLocationSearchQuery,
    setLocationSearchResults,
    setIsSearchingLocationForPanel,
    setLocationSearchModalCaller,
    clearSearchResults,
    setNewLocation,
    setClickedCoordinates,
    setIsSavingLocationPanel,
    resetNewLocation,
    setSelectedLocationId
  } = useLocationUI({
    onMemberSelect: handleMemberSelect,
    onLocationSelect: handleLocationSelect
  });

  // 멤버 선택 처리
  function handleMemberSelect(
    memberId: string, 
    openLocationPanel: boolean = false, 
    membersArray: any[] = [], 
    fromMarkerClick: boolean = false, 
    clickedMarker: any = null, 
    onlyShowInfoWindow: boolean = false
  ) {
    console.log('[handleMemberSelect] 멤버 선택:', memberId, 'openLocationPanel:', openLocationPanel);
    
    if (selectedMemberId === memberId) {
      console.log('[handleMemberSelect] 이미 선택된 멤버입니다.');
      return;
    }

    setSelectedMemberId(memberId);
    
    if (openLocationPanel) {
      openLocationInfoPanel();
    }
    
    // 마커 클릭으로부터의 선택인 경우
    if (fromMarkerClick && clickedMarker) {
      console.log('[handleMemberSelect] 마커 클릭으로 멤버 선택됨');
    }
  }

  // 위치 선택 처리
  function handleLocationSelect(location: any) {
    console.log('[handleLocationSelect] 위치 선택:', location);
    setSelectedLocation(location);
    setSelectedLocationId(location.id);
    openLocationInfoPanel();
  }

  // 지도 클릭 처리
  const handleMapClick = useCallback((lat: number, lng: number) => {
    console.log('[handleMapClick] 지도 클릭:', lat, lng);
    setClickedCoordinates([lat, lng]);
    
    // 새 위치 정보 초기화
    setNewLocation((prev: LocationData) => ({
      ...prev,
      coordinates: [lat, lng]
    }));
    
    // 편집 패널 열기
    openEditingPanel();
  }, [setClickedCoordinates, setNewLocation, openEditingPanel]);

  // 마커 클릭 처리
  const handleMarkerClick = useCallback((marker: any, memberId: string) => {
    console.log('[handleMarkerClick] 마커 클릭:', marker, memberId);
    
    // 멤버 선택
    handleMemberSelect(memberId, false, [], true, marker, false);
    
    // 인포윈도우 표시
    if (marker.infoWindow) {
      marker.infoWindow.open(marker.map, marker);
    }
  }, [handleMemberSelect]);

  // 인포윈도우 닫기 처리
  const handleInfoWindowClose = useCallback(() => {
    console.log('[handleInfoWindowClose] 인포윈도우 닫기');
    // 필요한 정리 작업 수행
  }, []);

  // 위치 저장 처리
  const handleSaveLocation = useCallback(async (locationData: any) => {
    try {
      // 데이터 검증
      const validation = validateLocationData(locationData);
      if (!validation.isValid) {
        showToastModal('error', '입력 오류', validation.errors.join('\n'));
        return;
      }

      // 데이터 정규화
      const normalizedData = normalizeLocationData(locationData);
      
      // 저장
      await saveLocation(normalizedData);
      
      showToastModal('success', '저장 완료', '위치가 성공적으로 저장되었습니다.');
      closeLocationInfoPanel();
      resetNewLocation();
      
      // 데이터 새로고침
      refreshData();
      
    } catch (error) {
      console.error('위치 저장 실패:', error);
      showToastModal('error', '저장 실패', '위치 저장 중 오류가 발생했습니다.');
    }
  }, [saveLocation, showToastModal, closeLocationInfoPanel, resetNewLocation, refreshData]);

  // 위치 편집 처리
  const handleEditLocation = useCallback(() => {
    openEditingPanel();
  }, [openEditingPanel]);

  // 위치 편집 취소 처리
  const handleCancelEditLocation = useCallback(() => {
    closeEditingPanel();
    if (selectedLocation) {
      // 원래 데이터로 복원
      setNewLocation(selectedLocation);
    }
  }, [closeEditingPanel, selectedLocation, setNewLocation]);

  // 위치 삭제 처리
  const handleDeleteLocation = useCallback(async () => {
    if (!locationToDelete) return;
    
    try {
      setIsDeletingLocation(true);
      await deleteLocation(locationToDelete.id);
      
      showToastModal('success', '삭제 완료', '위치가 성공적으로 삭제되었습니다.');
      closeLocationDeleteModal();
      closeLocationInfoPanel();
      setSelectedLocation(null);
      setSelectedLocationId(null);
      
      // 데이터 새로고침
      refreshData();
      
    } catch (error) {
      console.error('위치 삭제 실패:', error);
      showToastModal('error', '삭제 실패', '위치 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingLocation(false);
    }
  }, [locationToDelete, deleteLocation, setIsDeletingLocation, showToastModal, closeLocationDeleteModal, closeLocationInfoPanel, setSelectedLocation, setSelectedLocationId, refreshData]);

  // 위치 삭제 모달 열기
  const handleOpenDeleteModal = useCallback((location: any) => {
    setLocationToDelete(location);
    setIsLocationDeleteModalOpen(true);
  }, [setLocationToDelete, setIsLocationDeleteModalOpen]);

  // 에러 처리
  useEffect(() => {
    if (error) {
      showToastModal('error', '오류 발생', error);
    }
  }, [error, showToastModal]);

  // 로딩 상태 처리
  useEffect(() => {
    if (isLoading) {
      showToastModal('loading', '데이터 로딩 중', '위치 정보를 불러오는 중입니다...');
    } else {
      hideToastModal();
    }
  }, [isLoading, showToastModal, hideToastModal]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 사이드바 */}
      <LocationSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        className="hidden lg:block"
      >
        <div className="p-4">
          {/* 그룹 선택기 */}
          <div className="mb-4">
            <button
              onClick={openGroupSelector}
              className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              그룹 선택
            </button>
          </div>

          {/* 멤버 목록 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-800 mb-2">그룹 멤버</h3>
            {groupMembers.map((member) => (
              <div
                key={member.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedMemberId === member.id
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-white hover:bg-gray-50'
                }`}
                onClick={() => handleMemberSelect(member.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="text-sm text-gray-600">{member.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{member.name}</p>
                    <p className="text-sm text-gray-500">
                      {member.savedLocationCount || 0}개 위치
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </LocationSidebar>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-800">위치 관리</h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={refreshData}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="새로고침"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* 지도 영역 */}
        <div className="flex-1 relative">
          <LocationMap
            groupMembers={groupMembers}
            isMapLoading={isMapLoading}
            setIsMapLoading={setIsMapLoading}
            setIsMapInitialized={setIsMapInitialized}
            setIsMapReady={setIsMapReady}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            onInfoWindowClose={handleInfoWindowClose}
          />
        </div>
      </div>

      {/* 위치 정보 패널 */}
      <LocationInfoPanel
        isOpen={isLocationInfoPanelOpen}
        onClose={closeLocationInfoPanel}
        location={selectedLocation || newLocation}
        onEdit={handleEditLocation}
        onDelete={handleOpenDeleteModal}
        onSave={handleSaveLocation}
        isEditing={isEditingPanel}
        onCancelEdit={handleCancelEditLocation}
      />

      {/* 모달들 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={modalContent?.title || ''}
        message={modalContent?.message || ''}
        type={modalContent?.type || 'info'}
        onConfirm={modalContent?.onConfirm}
      />

      <LocationDeleteModal
        isOpen={isLocationDeleteModalOpen}
        onClose={closeLocationDeleteModal}
        onConfirm={handleDeleteLocation}
        location={locationToDelete}
        isDeleting={isDeletingLocation}
      />

      <ToastModal
        isOpen={toastModal.isOpen}
        type={toastModal.type}
        title={toastModal.title}
        message={toastModal.message}
        progress={toastModal.progress}
        autoClose={toastModal.autoClose}
        onClose={hideToastModal}
      />
    </div>
  );
}
