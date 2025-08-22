'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useLocationMap } from '../hooks/useLocationMap';
import { LocationMarkers } from './LocationMarkers';

interface LocationMapProps {
  groupMembers: any[];
  isMapLoading: boolean;
  setIsMapLoading: (loading: boolean) => void;
  setIsMapInitialized: (initialized: boolean) => void;
  setIsMapReady: (ready: boolean) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (marker: any, memberId: string) => void;
  onInfoWindowClose: () => void;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  groupMembers,
  isMapLoading,
  setIsMapLoading,
  setIsMapInitialized,
  setIsMapReady,
  onMapClick,
  onMarkerClick,
  onInfoWindowClose
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [isMapScriptLoaded, setIsMapScriptLoaded] = useState(false);

  const {
    map,
    markers,
    infoWindows,
    isMapInitialized: mapInitialized,
    isMapReady: mapReady,
    handleMapClick,
    handleMarkerClick,
    handleInfoWindowClose,
    clearMarkers,
    clearInfoWindows,
    updateMarkerPositions,
    fitMapToMarkers
  } = useLocationMap({
    mapContainer,
    groupMembers,
    isMapLoading,
    setIsMapLoading,
    setIsMapInitialized,
    setIsMapReady
  });

  // 네이버 지도 스크립트 로드
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.naver) {
      const script = document.createElement('script');
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&submodules=geocoder`;
      script.async = true;
      script.onload = () => {
        setIsMapScriptLoaded(true);
      };
      document.head.appendChild(script);
    } else if (window.naver) {
      setIsMapScriptLoaded(true);
    }
  }, []);

  // 지도 클릭 이벤트 처리
  const handleMapClickEvent = (lat: number, lng: number) => {
    onMapClick(lat, lng);
  };

  // 마커 클릭 이벤트 처리
  const handleMarkerClickEvent = (marker: any, memberId: string) => {
    onMarkerClick(marker, memberId);
  };

  // 인포윈도우 닫기 이벤트 처리
  const handleInfoWindowCloseEvent = () => {
    onInfoWindowClose();
  };

  return (
    <div className="relative w-full h-full">
      {/* 지도 컨테이너 */}
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {/* 지도 로딩 인디케이터 */}
      {isMapLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">지도를 불러오는 중...</p>
          </div>
        </div>
      )}
      
      {/* 마커 및 인포윈도우 컴포넌트 */}
      {isMapScriptLoaded && mapInitialized && (
        <LocationMarkers
          map={map}
          markers={markers}
          infoWindows={infoWindows}
          groupMembers={groupMembers}
          onMarkerClick={handleMarkerClickEvent}
          onInfoWindowClose={handleInfoWindowCloseEvent}
          onMapClick={handleMapClickEvent}
        />
      )}
      
      {/* 지도 컨트롤 버튼들 */}
      {mapReady && (
        <div className="absolute top-4 right-4 z-20 space-y-2">
          {/* 마커에 맞춰 지도 이동 버튼 */}
          <button
            onClick={fitMapToMarkers}
            className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="마커에 맞춰 지도 이동"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          
          {/* 현재 위치로 이동 버튼 */}
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude } = position.coords;
                    if (map && window.naver) {
                      const coord = new window.naver.maps.LatLng(latitude, longitude);
                      map.setCenter(coord);
                      map.setZoom(15);
                    }
                  },
                  (error) => {
                    console.error('현재 위치를 가져올 수 없습니다:', error);
                  }
                );
              }
            }}
            className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="현재 위치로 이동"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
