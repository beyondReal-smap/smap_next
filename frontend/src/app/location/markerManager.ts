import { 
  NaverMap, 
  NaverMarker, 
  NaverInfoWindow, 
  NaverLatLng,
  GroupMember, 
  LocationData 
} from './types';
import { getDefaultImage } from './utils';

export class MarkerManager {
  private map: NaverMap | null = null;
  private memberMarkers: NaverMarker[] = [];
  private locationMarkers: NaverMarker[] = [];
  private infoWindow: NaverInfoWindow | null = null;
  private tempMarker: NaverMarker | null = null;

  constructor(map: NaverMap) {
    this.map = map;
  }

  // 모든 마커 제거
  public clearAllMarkers(): void {
    // 기존 InfoWindow 닫기
    if (this.infoWindow) {
      this.infoWindow.close();
      this.infoWindow = null;
    }
    
    // 장소 마커들 제거
    this.locationMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    this.locationMarkers = [];
    
    // 멤버 마커들 제거
    this.memberMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    this.memberMarkers = [];
    
    // 임시 마커도 제거
    if (this.tempMarker) {
      this.tempMarker.setMap(null);
      this.tempMarker = null;
    }
  }

  // 멤버 마커 생성
  public createMemberMarkers(members: GroupMember[]): void {
    if (!this.map) return;
    
    this.memberMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    this.memberMarkers = [];
    
    members.forEach(member => {
      if (member.coordinates && member.coordinates[0] !== 0 && member.coordinates[1] !== 0) {
        const position = new window.naver.maps.LatLng(
          member.coordinates[0], 
          member.coordinates[1]
        );
        
        const photoUrl = member.photo || getDefaultImage(member.mt_gender, member.original_index);
        
        const marker = new window.naver.maps.Marker({
          position,
          map: this.map,
          title: member.name,
          icon: {
            content: `
              <div style="
                width: 32px;
                height: 32px;
                background-color: #f59e0b;
                border: 2px solid white;
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              ">
                <img src="${photoUrl}" 
                     style="width: 100%; height: 100%; object-fit: cover;" 
                     alt="${member.name}" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <span style="color: white; font-weight: bold; font-size: 14px; display: none;">
                  ${member.name.charAt(0)}
                </span>
              </div>
            `,
            anchor: new window.naver.maps.Point(16, 16)
          }
        });
        
        this.memberMarkers.push(marker);
      }
    });
  }

  // 장소 마커 생성
  public createLocationMarkers(
    locations: LocationData[], 
    selectedLocationId: string | null,
    onLocationClick?: (location: LocationData) => void
  ): void {
    if (!this.map) return;
    
    this.locationMarkers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    this.locationMarkers = [];
    
    locations.forEach(location => {
      if (location.coordinates[0] === 0 || location.coordinates[1] === 0) return;
      
      const position = new window.naver.maps.LatLng(
        location.coordinates[0], 
        location.coordinates[1]
      );
      
      const isSelected = selectedLocationId === location.id;
      
      const marker = new window.naver.maps.Marker({
        position,
        map: this.map,
        title: location.name,
        icon: {
          content: `
            <div style="position: relative; text-align: center;">
              <div style="
                width: 28px;
                height: 28px;
                background-color: white;
                border: 2px solid ${isSelected ? '#ef4444' : '#6366f1'};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                z-index: ${isSelected ? '200' : '150'};
              ">
                <svg width="16" height="16" fill="${isSelected ? '#ef4444' : '#6366f1'}" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
                </svg>
              </div>
            </div>
          `,
          anchor: new window.naver.maps.Point(14, 14)
        }
      });
      
      // 마커 클릭 이벤트
      if (onLocationClick) {
        window.naver.maps.Event.addListener(marker, 'click', () => {
          onLocationClick(location);
        });
      }
      
      this.locationMarkers.push(marker);
    });
  }

  // 특정 장소 마커 제거
  public removeLocationMarker(locationId: string): void {
    const markerToRemove = this.locationMarkers.find(marker => 
      marker.getTitle() === locationId
    );
    
    if (markerToRemove) {
      markerToRemove.setMap(null);
      this.locationMarkers = this.locationMarkers.filter(m => m !== markerToRemove);
    }
  }

  // 임시 마커 생성 (새 장소 추가 시)
  public createTempMarker(coordinates: [number, number]): void {
    if (!this.map) return;
    
    if (this.tempMarker) {
      this.tempMarker.setMap(null);
    }
    
    const position = new window.naver.maps.LatLng(coordinates[0], coordinates[1]);
    
    this.tempMarker = new window.naver.maps.Marker({
      position,
      map: this.map,
      title: '새 장소',
      icon: {
        content: `
          <div style="
            width: 28px;
            height: 28px;
            background-color: #10b981;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">
            <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
            </svg>
          </div>
        `,
        anchor: new window.naver.maps.Point(14, 14)
      }
    });
  }

  // 임시 마커 제거
  public removeTempMarker(): void {
    if (this.tempMarker) {
      this.tempMarker.setMap(null);
      this.tempMarker = null;
    }
  }

  // 마커 스타일 업데이트 (선택 상태 변경 시)
  public updateLocationMarkerStyle(locationId: string, isSelected: boolean): void {
    const marker = this.locationMarkers.find(m => m.getTitle() === locationId);
    if (!marker) return;
    
    const newIcon = {
      content: `
        <div style="
          width: 28px;
          height: 28px;
          background-color: white;
          border: 2px solid ${isSelected ? '#ef4444' : '#6366f1'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">
          <svg width="16" height="16" fill="${isSelected ? '#ef4444' : '#6366f1'}" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
          </svg>
        </div>
      `,
      anchor: new window.naver.maps.Point(14, 14)
    };
    
    marker.setIcon(newIcon);
  }

  // 현재 마커 상태 반환
  public getMarkerState() {
    return {
      memberMarkers: this.memberMarkers,
      locationMarkers: this.locationMarkers,
      infoWindow: this.infoWindow,
      tempMarker: this.tempMarker
    };
  }

  // 맵 변경
  public setMap(map: NaverMap): void {
    this.map = map;
  }

  // 맵 정리
  public destroy(): void {
    this.clearAllMarkers();
    this.map = null;
  }
}
