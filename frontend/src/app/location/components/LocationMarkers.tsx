'use client';

import React, { useEffect, useRef } from 'react';

// 타입 정의
declare global {
  interface Window {
    naver: any;
  }
}

type NaverMap = any;
type NaverMarker = any;
type NaverInfoWindow = any;

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  mt_file1?: string | null;
  isSelected: boolean;
  location: {
    lat: number;
    lng: number;
  };
  mlt_lat?: number | null;
  mlt_long?: number | null;
  mt_gender?: number | null;
  original_index: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}

interface LocationMarkersProps {
  map: NaverMap;
  markers: NaverMarker[];
  infoWindows: NaverInfoWindow[];
  groupMembers: GroupMember[];
  onMarkerClick: (marker: NaverMarker, memberId: string) => void;
  onInfoWindowClose: () => void;
  onMapClick: (lat: number, lng: number) => void;
}

export const LocationMarkers: React.FC<LocationMarkersProps> = ({
  map,
  markers,
  infoWindows,
  groupMembers,
  onMarkerClick,
  onInfoWindowClose,
  onMapClick
}) => {
  const markersRef = useRef<{ [key: string]: NaverMarker }>({});
  const infoWindowsRef = useRef<{ [key: string]: NaverInfoWindow }>({});

  // 마커 생성 및 관리
  useEffect(() => {
    if (!map || !groupMembers.length) return;

    // 기존 마커 제거
    Object.values(markersRef.current).forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    Object.values(infoWindowsRef.current).forEach(infoWindow => {
      if (infoWindow && infoWindow.close) {
        infoWindow.close();
      }
    });

    markersRef.current = {};
    infoWindowsRef.current = {};

    // 새 마커 생성
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
              background: ${member.isSelected ? '#EF4444' : '#3B82F6'};
              color: white;
              padding: 8px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              border: 2px solid white;
            ">
              ${member.name}
            </div>
          `,
          size: new window.naver.maps.Size(0, 0),
          anchor: new window.naver.maps.Point(0, 0)
        },
        zIndex: member.isSelected ? 1000 : 100
      });

      // 인포윈도우 생성
      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="padding: 16px; min-width: 200px;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <div style="
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: ${member.mt_file1 ? 'url(' + member.mt_file1 + ')' : '#E5E7EB'};
                background-size: cover;
                background-position: center;
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6B7280;
                font-weight: 600;
              ">
                ${member.mt_file1 ? '' : member.name.charAt(0)}
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
                  ${member.name}
                </h3>
                <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 12px;">
                  ${member.isSelected ? '선택된 멤버' : '그룹 멤버'}
                </p>
              </div>
            </div>
            <div style="border-top: 1px solid #E5E7EB; padding-top: 12px;">
              <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">
                <strong>현재 위치</strong>
              </p>
              <p style="margin: 0; color: #6B7280; font-size: 12px;">
                위도: ${member.mlt_lat?.toFixed(6) || 'N/A'}
              </p>
              <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 12px;">
                경도: ${member.mlt_long?.toFixed(6) || 'N/A'}
              </p>
            </div>
            ${member.sgdt_owner_chk === 'Y' ? `
              <div style="
                margin-top: 12px;
                padding: 8px 12px;
                background: #FEF3C7;
                border-radius: 6px;
                text-align: center;
              ">
                <span style="color: #92400E; font-size: 12px; font-weight: 600;">
                  👑 그룹장
                </span>
              </div>
            ` : ''}
            ${member.sgdt_leader_chk === 'Y' ? `
              <div style="
                margin-top: 8px;
                padding: 8px 12px;
                background: #DBEAFE;
                border-radius: 6px;
                text-align: center;
              ">
                <span style="color: #1E40AF; font-size: 12px; font-weight: 600;">
                  ⭐ 리더
                </span>
              </div>
            ` : ''}
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'white',
        borderRadius: 12,
        anchorSize: new window.naver.maps.Size(0, 0),
        anchorColor: 'white',
        pixelOffset: new window.naver.maps.Point(0, -10)
      });

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onMarkerClick(marker, member.id);
        
        // 다른 인포윈도우 닫기
        Object.values(infoWindowsRef.current).forEach(iw => {
          if (iw !== infoWindow) {
            iw.close();
          }
        });
        
        // 현재 인포윈도우 열기
        infoWindow.open(map, marker);
      });

      // 인포윈도우 닫기 이벤트
      window.naver.maps.Event.addListener(infoWindow, 'closeclick', () => {
        onInfoWindowClose();
      });

      // 참조 저장
      markersRef.current[member.id] = marker;
      infoWindowsRef.current[member.id] = infoWindow;
    });

    // 정리 함수
    return () => {
      Object.values(markersRef.current).forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
      Object.values(infoWindowsRef.current).forEach(infoWindow => {
        if (infoWindow && infoWindow.close) {
          infoWindow.close();
        }
      });
    };
  }, [map, groupMembers, onMarkerClick, onInfoWindowClose]);

  // 지도 클릭 이벤트
  useEffect(() => {
    if (!map) return;

    const handleMapClick = (e: any) => {
      const coord = e.coord;
      onMapClick(coord.lat(), coord.lng());
      
      // 모든 인포윈도우 닫기
      Object.values(infoWindowsRef.current).forEach(infoWindow => {
        if (infoWindow && infoWindow.close) {
          infoWindow.close();
        }
      });
    };

    window.naver.maps.Event.addListener(map, 'click', handleMapClick);

    return () => {
      if (map) {
        window.naver.maps.Event.removeListener(map, 'click', handleMapClick);
      }
    };
  }, [map, onMapClick]);

  // 컴포넌트가 렌더링되지 않음 (마커는 지도에 직접 추가됨)
  return null;
};
