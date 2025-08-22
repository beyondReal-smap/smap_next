'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

type NaverMap = any;
type NaverCoord = any;
type NaverMarker = any;
type NaverInfoWindow = any;

interface GroupMember {
  id: string;
  name: string;
  mlt_lat?: number | null;
  mlt_long?: number | null;
  location: {
    lat: number;
    lng: number;
  };
}

interface UseLocationMapProps {
  mapContainer: React.RefObject<HTMLDivElement>;
  groupMembers: GroupMember[];
  isMapLoading: boolean;
  setIsMapLoading: (loading: boolean) => void;
  setIsMapInitialized: (initialized: boolean) => void;
  setIsMapReady: (ready: boolean) => void;
}

export const useLocationMap = ({
  mapContainer,
  groupMembers,
  isMapLoading,
  setIsMapLoading,
  setIsMapInitialized,
  setIsMapReady
}: UseLocationMapProps) => {
  const [map, setMap] = useState<NaverMap | null>(null);
  const [markers, setMarkers] = useState<NaverMarker[]>([]);
  const [infoWindows, setInfoWindows] = useState<NaverInfoWindow[]>([]);
  const [isMapInitialized, setIsMapInitializedLocal] = useState(false);
  const [isMapReady, setIsMapReadyLocal] = useState(false);
  
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const infoWindowsRef = useRef<NaverInfoWindow[]>([]);

  // 지도 초기화
  const initializeMap = useCallback(async () => {
    if (!mapContainer.current || !window.naver || mapRef.current) return;

    try {
      setIsMapLoading(true);
      
      // 네이버 지도 생성
      const naverMap = new window.naver.maps.Map(mapContainer.current, {
        center: new window.naver.maps.LatLng(37.5665, 126.9780), // 서울 시청
        zoom: 12,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
        zoomControl: true,
        minZoom: 6,
        maxZoom: 18
      });

      mapRef.current = naverMap;
      setMap(naverMap);
      
      // 지도 클릭 이벤트
      window.naver.maps.Event.addListener(naverMap, 'click', (e: any) => {
        const coord = e.coord;
        handleMapClick(coord.lat(), coord.lng());
      });

      setIsMapInitializedLocal(true);
      setIsMapInitialized(true);
      setIsMapReadyLocal(true);
      setIsMapReady(true);
      
    } catch (error) {
      console.error('지도 초기화 실패:', error);
    } finally {
      setIsMapLoading(false);
    }
  }, [mapContainer, setIsMapLoading, setIsMapInitialized, setIsMapReady]);

  // 지도 클릭 처리
  const handleMapClick = useCallback((lat: number, lng: number) => {
    console.log('[handleMapClick] 지도 클릭:', lat, lng);
    // 상위 컴포넌트에서 처리할 수 있도록 이벤트 발생
  }, []);

  // 마커 클릭 처리
  const handleMarkerClick = useCallback((marker: NaverMarker, memberId: string) => {
    console.log('[handleMarkerClick] 마커 클릭:', marker, memberId);
    // 상위 컴포넌트에서 처리할 수 있도록 이벤트 발생
  }, []);

  // 인포윈도우 닫기 처리
  const handleInfoWindowClose = useCallback(() => {
    console.log('[handleInfoWindowClose] 인포윈도우 닫기');
    // 상위 컴포넌트에서 처리할 수 있도록 이벤트 발생
  }, []);

  // 마커 생성
  const createMarkers = useCallback(() => {
    if (!map || !groupMembers.length) return;

    // 기존 마커 제거
    clearMarkers();

    const newMarkers: NaverMarker[] = [];
    const newInfoWindows: NaverInfoWindow[] = [];

    groupMembers.forEach((member) => {
      if (!member.mlt_lat || !member.mlt_long) return;

      const position = new window.naver.maps.LatLng(member.mlt_lat, member.mlt_long);
      
      // 마커 생성
      const marker = new window.naver.maps.Marker({
        position,
        map,
        icon: {
          content: `
            <div style="
              background: #3B82F6;
              color: white;
              padding: 8px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            ">
              ${member.name}
            </div>
          `,
          size: new window.naver.maps.Size(0, 0),
          anchor: new window.naver.maps.Point(0, 0)
        }
      });

      // 인포윈도우 생성
      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="padding: 16px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
              ${member.name}
            </h3>
            <p style="margin: 0; color: #666; font-size: 14px;">
              현재 위치
            </p>
            <p style="margin: 4px 0 0 0; color: #999; font-size: 12px;">
              ${member.mlt_lat?.toFixed(6)}, ${member.mlt_long?.toFixed(6)}
            </p>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'white',
        borderRadius: 8,
        anchorSize: new window.naver.maps.Size(0, 0),
        anchorColor: 'white'
      });

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, 'click', () => {
        handleMarkerClick(marker, member.id);
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    markersRef.current = newMarkers;
    infoWindowsRef.current = newInfoWindows;
    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);
  }, [map, groupMembers, handleMarkerClick]);

  // 마커 제거
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    infoWindowsRef.current.forEach(infoWindow => {
      infoWindow.close();
    });
    
    markersRef.current = [];
    infoWindowsRef.current = [];
    setMarkers([]);
    setInfoWindows([]);
  }, []);

  // 인포윈도우 제거
  const clearInfoWindows = useCallback(() => {
    infoWindowsRef.current.forEach(infoWindow => {
      infoWindow.close();
    });
    infoWindowsRef.current = [];
    setInfoWindows([]);
  }, []);

  // 마커 위치 업데이트
  const updateMarkerPositions = useCallback(() => {
    if (!map || !groupMembers.length) return;
    
    // 마커 재생성
    createMarkers();
  }, [map, groupMembers, createMarkers]);

  // 마커에 맞춰 지도 이동
  const fitMapToMarkers = useCallback(() => {
    if (!map || !markersRef.current.length) return;

    const bounds = new window.naver.maps.LatLngBounds();
    markersRef.current.forEach(marker => {
      bounds.extend(marker.getPosition());
    });

    map.fitBounds(bounds, 50); // 50px 여백
  }, [map]);

  // 지도 초기화
  useEffect(() => {
    if (window.naver && mapContainer.current && !mapRef.current) {
      initializeMap();
    }
  }, [initializeMap, mapContainer]);

  // 그룹 멤버 변경 시 마커 업데이트
  useEffect(() => {
    if (isMapInitialized && groupMembers.length > 0) {
      createMarkers();
    }
  }, [isMapInitialized, groupMembers, createMarkers]);

  return {
    map,
    markers,
    infoWindows,
    isMapInitialized,
    isMapReady,
    handleMapClick,
    handleMarkerClick,
    handleInfoWindowClose,
    clearMarkers,
    clearInfoWindows,
    updateMarkerPositions,
    fitMapToMarkers
  };
};
