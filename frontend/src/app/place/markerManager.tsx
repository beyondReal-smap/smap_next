'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// 타입 정의
interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: { lat: number; lng: number };
  schedules: any[];
  savedLocations: LocationData[];
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  mlt_lat?: number | null;
  mlt_long?: number | null;
}

type NaverMap = any;
type NaverMarker = any;
type NaverInfoWindow = any;

// 유틸리티 함수들
const parseCoordinate = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? null : parsed;
};

const createSafeLatLng = (lat: number, lng: number): any => {
  if (!window.naver?.maps?.LatLng) return null;
  try {
    return new window.naver.maps.LatLng(lat, lng);
  } catch (error) {
    console.error('[createSafeLatLng] LatLng 생성 실패:', error);
    return null;
  }
};

const getDefaultImage = (gender: number | null | undefined, index: number): string => {
  const maleImages = ['/images/male_1.png', '/images/male_2.png', '/images/male_3.png', '/images/male_4.png'];
  const femaleImages = ['/images/female_1.png', '/images/female_2.png', '/images/female_3.png', '/images/female_4.png'];
  const defaultImages = ['/images/avatar1.png', '/images/avatar2.png', '/images/avatar3.png', '/images/avatar4.png'];
  
  if (gender === 1) return maleImages[index % maleImages.length];
  if (gender === 2) return femaleImages[index % femaleImages.length];
  return defaultImages[index % defaultImages.length];
};

const getSafeImageUrl = (photo: string | null, gender: number | null | undefined, index: number): string => {
  if (photo && photo.trim() !== '') {
    return photo;
  }
  return getDefaultImage(gender, index);
};

interface MarkerManagerProps {
  map: NaverMap | null;
  groupMembers: GroupMember[];
  selectedMemberId: string | null;
  selectedMemberSavedLocations: LocationData[];
  selectedLocationId: string | null;
  onMarkerClick: (locationId: string) => void;
  onMemberMarkerClick: (memberId: string) => void;
  onInfoWindowClose: () => void;
}

export default function MarkerManager({
  map,
  groupMembers,
  selectedMemberId,
  selectedMemberSavedLocations,
  selectedLocationId,
  onMarkerClick,
  onMemberMarkerClick,
  onInfoWindowClose
}: MarkerManagerProps) {
  const markersRef = useRef<NaverMarker[]>([]);
  const memberMarkersRef = useRef<NaverMarker[]>([]);
  const infoWindowRef = useRef<NaverInfoWindow | null>(null);

  // 멤버 마커 생성
  const createMemberMarkers = useCallback(() => {
    if (!map || !window.naver?.maps) return;

    // 기존 멤버 마커 제거
    memberMarkersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    memberMarkersRef.current = [];

    // 새 멤버 마커 생성
    const newMemberMarkers: NaverMarker[] = [];
    
    groupMembers.forEach((member, index) => {
      const lat = parseCoordinate(member.mlt_lat) || parseCoordinate(member.location?.lat);
      const lng = parseCoordinate(member.mlt_long) || parseCoordinate(member.location?.lng);

      if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
        const position = createSafeLatLng(lat, lng);
        if (!position) return;

        const borderColor = member.isSelected ? '#ef4444' : '#0113A3';
        const photoUrl = getSafeImageUrl(member.photo, member.mt_gender, member.original_index);
        
        const marker = new window.naver.maps.Marker({
          position,
          map,
          title: member.name,
          icon: {
            content: `
              <div style="
                position: relative;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                border: 3px solid ${borderColor};
                overflow: hidden;
                cursor: pointer;
                transition: all 0.2s ease;
              " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${photoUrl}" 
                     alt="${member.name}" 
                     style="
                       width: 100%;
                       height: 100%;
                       object-fit: cover;
                     "
                     onerror="this.src='/images/avatar1.png'"
                />
                ${member.isSelected ? `
                  <div style="
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    width: 16px;
                    height: 16px;
                    background: #ef4444;
                    border: 2px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <div style="
                      width: 6px;
                      height: 6px;
                      background: white;
                      border-radius: 50%;
                    "></div>
                  </div>
                ` : ''}
              </div>
            `,
            anchor: new window.naver.maps.Point(24, 24)
          },
          zIndex: member.isSelected ? 200 : 150
        });

        // 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          onMemberMarkerClick(member.id);
        });

        newMemberMarkers.push(marker);
      }
    });

    memberMarkersRef.current = newMemberMarkers;
  }, [map, groupMembers, onMemberMarkerClick]);

  // 장소 마커 생성
  const createLocationMarkers = useCallback(() => {
    if (!map || !window.naver?.maps) return;

    // 기존 장소 마커 제거
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    // 새 장소 마커 생성
    const newMarkers: NaverMarker[] = [];
    
    selectedMemberSavedLocations.forEach((location, index) => {
      const [lng, lat] = location.coordinates;
      
      if (lat !== 0 && lng !== 0) {
        const position = createSafeLatLng(lat, lng);
        if (!position) return;

        const isSelected = selectedLocationId === location.id;
        const markerColor = isSelected ? '#ef4444' : '#10b981';
        
        const marker = new window.naver.maps.Marker({
          position,
          map,
          title: location.name,
          icon: {
            content: `
              <div style="
                position: relative;
                width: 32px;
                height: 32px;
                background: ${markerColor};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
              " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <span style="
                  color: white;
                  font-size: 16px;
                  font-weight: bold;
                ">📍</span>
                ${isSelected ? `
                  <div style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 20px;
                    height: 20px;
                    background: #ef4444;
                    border: 2px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <div style="
                      width: 8px;
                      height: 8px;
                      background: white;
                      border-radius: 50%;
                    "></div>
                  </div>
                ` : ''}
              </div>
            `,
            anchor: new window.naver.maps.Point(16, 16)
          },
          zIndex: isSelected ? 300 : 100
        });

        // 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          onMarkerClick(location.id);
        });

        newMarkers.push(marker);
      }
    });

    markersRef.current = newMarkers;
  }, [map, selectedMemberSavedLocations, selectedLocationId, onMarkerClick]);

  // 멤버 InfoWindow 생성
  const createMemberInfoWindow = useCallback((member: GroupMember, marker: NaverMarker) => {
    if (!map || !window.naver?.maps) return;

    // 기존 InfoWindow 닫기
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const infoWindowContent = `
      <div class="member-info-window-container" style="
        min-width: 280px;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        border: 1px solid rgba(0,0,0,0.1);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <img src="${getSafeImageUrl(member.photo, member.mt_gender, member.original_index)}" 
               alt="${member.name}" 
               style="
                 width: 48px; 
                 height: 48px; 
                 border-radius: 50%; 
                 object-fit: cover;
                 border: 2px solid ${member.isSelected ? '#ef4444' : '#0113A3'};
               "
               onerror="this.src='/images/avatar1.png'"
          />
          <div>
            <div style="
              font-weight: 600; 
              font-size: 16px; 
              color: #1f2937; 
              margin-bottom: 4px;
            ">${member.name}</div>
            <div style="
              font-size: 14px; 
              color: #6b7280;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="
                width: 8px; 
                height: 8px; 
                background: #10b981; 
                border-radius: 50%;
                display: inline-block;
              "></span>
              온라인
            </div>
          </div>
        </div>
        
        <div style="
          background: #f8fafc; 
          padding: 12px; 
          border-radius: 8px; 
          margin-bottom: 12px;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            font-size: 14px; 
            color: #374151; 
            margin-bottom: 8px;
            font-weight: 500;
          ">현재 위치</div>
          <div style="
            font-size: 13px; 
            color: #6b7280;
            line-height: 1.4;
          ">${member.address || '위치 정보 없음'}</div>
        </div>
        
        <div style="
          display: flex; 
          gap: 8px; 
          margin-bottom: 12px;
        ">
          <div style="
            background: #f3f4f6; 
            padding: 8px 12px; 
            border-radius: 6px; 
            flex: 1;
            text-align: center;
          ">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 2px;">저장된 장소</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${member.savedLocationCount || member.savedLocations?.length || 0}</div>
          </div>
          <div style="
            background: #f3f4f6; 
            padding: 8px 12px; 
            border-radius: 6px; 
            flex: 1;
            text-align: center;
          ">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 2px;">일정</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${member.schedules?.length || 0}</div>
          </div>
        </div>
        
        <div style="
          display: flex; 
          gap: 8px;
        ">
          <button onclick="window.closeInfoWindow()" style="
            flex: 1;
            padding: 10px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            color: #374151;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
            닫기
          </button>
          <button onclick="window.moveToMemberLocation('${member.id}')" style="
            flex: 1;
            padding: 10px 16px;
            background: #0113A3;
            border: 1px solid #0113A3;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#000f8a'" onmouseout="this.style.background='#0113A3'">
            위치로 이동
          </button>
        </div>
      </div>
    `;

    const newInfoWindow = new window.naver.maps.InfoWindow({
      content: infoWindowContent,
      maxWidth: 320,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      anchorSize: new window.naver.maps.Size(0, 0),
      anchorColor: 'transparent',
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    newInfoWindow.open(map, marker);
    infoWindowRef.current = newInfoWindow;

    // 전역 함수 등록
    (window as any).closeInfoWindow = () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
      onInfoWindowClose();
    };

    (window as any).moveToMemberLocation = (memberId: string) => {
      const member = groupMembers.find(m => m.id === memberId);
      if (member && map) {
        const lat = parseCoordinate(member.mlt_lat) || parseCoordinate(member.location?.lat);
        const lng = parseCoordinate(member.mlt_long) || parseCoordinate(member.location?.lng);
        
        if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
          const position = createSafeLatLng(lat, lng);
          if (position) {
            map.panTo(position, {
              duration: 800,
              easing: 'easeOutCubic'
            });
          }
        }
      }
    };
  }, [map, groupMembers, onInfoWindowClose]);

  // 장소 InfoWindow 생성
  const createLocationInfoWindow = useCallback((location: LocationData, marker: NaverMarker) => {
    if (!map || !window.naver?.maps) return;

    // 기존 InfoWindow 닫기
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const infoWindowContent = `
      <div class="location-info-window-container" style="
        min-width: 300px;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        border: 1px solid rgba(0,0,0,0.1);
      ">
        <div style="
          display: flex; 
          align-items: center; 
          gap: 12px; 
          margin-bottom: 16px;
        ">
          <div style="
            width: 48px; 
            height: 48px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: 600;
          ">📍</div>
          <div style="flex: 1;">
            <div style="
              font-weight: 600; 
              font-size: 16px; 
              color: #1f2937; 
              margin-bottom: 4px;
              line-height: 1.3;
            ">${location.name}</div>
            <div style="
              font-size: 13px; 
              color: #6b7280;
              line-height: 1.4;
            ">${location.address}</div>
          </div>
        </div>
        
        <div style="
          background: #f8fafc; 
          padding: 12px; 
          border-radius: 8px; 
          margin-bottom: 16px;
          border: 1px solid #e2e8f0;
        ">
          <div style="
            font-size: 14px; 
            color: #374151; 
            margin-bottom: 8px;
            font-weight: 500;
          ">장소 정보</div>
          <div style="
            font-size: 13px; 
            color: #6b7280;
            line-height: 1.4;
          ">
            카테고리: ${location.category || '기타'}<br/>
            메모: ${location.memo || '메모 없음'}<br/>
            즐겨찾기: ${location.favorite ? '✅' : '❌'}
          </div>
        </div>
        
        <div style="
          display: flex; 
          gap: 8px;
        ">
          <button onclick="window.toggleLocationNotification('${location.id}')" style="
            flex: 1;
            padding: 10px 16px;
            background: ${location.notifications ? '#ef4444' : '#10b981'};
            border: 1px solid ${location.notifications ? '#ef4444' : '#10b981'};
            border-radius: 6px;
            color: white;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.background='${location.notifications ? '#dc2626' : '#059669'}'" onmouseout="this.style.background='${location.notifications ? '#ef4444' : '#10b981'}'">
            ${location.notifications ? '알림 끄기' : '알림 켜기'}
          </button>
          <button onclick="window.deleteLocation('${location.id}')" style="
            flex: 1;
            padding: 10px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            color: #ef4444;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
            삭제
          </button>
        </div>
        
        <div style="
          margin-top: 12px;
          text-align: center;
        ">
          <button onclick="window.closeInfoWindow()" style="
            padding: 8px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            color: #6b7280;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
            닫기
          </button>
        </div>
      </div>
    `;

    const newInfoWindow = new window.naver.maps.InfoWindow({
      content: infoWindowContent,
      maxWidth: 340,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      anchorSize: new window.naver.maps.Size(0, 0),
      anchorColor: 'transparent',
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    newInfoWindow.open(map, marker);
    infoWindowRef.current = newInfoWindow;

    // 전역 함수 등록
    (window as any).closeInfoWindow = () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
      onInfoWindowClose();
    };

    (window as any).toggleLocationNotification = (locationId: string) => {
      // 알림 토글 로직 구현
      console.log('알림 토글:', locationId);
    };

    (window as any).deleteLocation = (locationId: string) => {
      // 장소 삭제 로직 구현
      console.log('장소 삭제:', locationId);
    };
  }, [map, onInfoWindowClose]);

  // 마커 업데이트
  useEffect(() => {
    if (map) {
      createMemberMarkers();
    }
  }, [map, groupMembers, createMemberMarkers]);

  useEffect(() => {
    if (map) {
      createLocationMarkers();
    }
  }, [map, selectedMemberSavedLocations, selectedLocationId, createLocationMarkers]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 전역 함수 제거
      delete (window as any).closeInfoWindow;
      delete (window as any).moveToMemberLocation;
      delete (window as any).toggleLocationNotification;
      delete (window as any).deleteLocation;
    };
  }, []);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}
