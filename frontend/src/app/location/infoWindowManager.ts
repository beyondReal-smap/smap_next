import { 
  NaverMap, 
  NaverInfoWindow, 
  NaverLatLng,
  GroupMember, 
  LocationData 
} from './types';
import { getDefaultImage } from './utils';

export class InfoWindowManager {
  private map: NaverMap | null = null;
  private currentInfoWindow: NaverInfoWindow | null = null;

  constructor(map: NaverMap) {
    this.map = map;
  }

  // 현재 InfoWindow 닫기
  public closeCurrentInfoWindow(): void {
    if (this.currentInfoWindow) {
      this.currentInfoWindow.close();
      this.currentInfoWindow = null;
    }
  }

  // 장소 InfoWindow 표시
  public showLocationInfoWindow(
    location: LocationData,
    onClose?: () => void,
    onDelete?: (locationId: string) => void
  ): void {
    if (!this.map) return;
    
    // 기존 InfoWindow 닫기
    this.closeCurrentInfoWindow();
    
    const position = new window.naver.maps.LatLng(
      location.coordinates[0], 
      location.coordinates[1]
    );
    
    const content = `
      <div style="
        padding: 16px;
        min-width: 200px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">
          ${location.name}
        </h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; line-height: 1.4;">
          ${location.address || '주소 정보 없음'}
        </p>
        ${location.memo ? `
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151; line-height: 1.4;">
            ${location.memo}
          </p>
        ` : ''}
        <div style="display: flex; gap: 8px;">
          <button onclick="window.closeLocationInfoWindow()" style="
            padding: 6px 12px;
            background-color: #6b7280;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
          ">닫기</button>
          <button onclick="window.deleteLocation('${location.id}')" style="
            padding: 6px 12px;
            background-color: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
          ">삭제</button>
        </div>
      </div>
    `;
    
    const newInfoWindow = new window.naver.maps.InfoWindow({
      content,
      position,
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      anchorSize: new window.naver.maps.Size(10, 10)
    });
    
    newInfoWindow.open(this.map);
    this.currentInfoWindow = newInfoWindow;
    
    // 전역 함수 등록
    (window as any).closeLocationInfoWindow = () => {
      this.closeCurrentInfoWindow();
      if (onClose) onClose();
    };
    
    (window as any).deleteLocation = async (locId: string) => {
      if (confirm('이 장소를 정말 삭제하시겠습니까?')) {
        if (onDelete) {
          onDelete(locId);
        }
        this.closeCurrentInfoWindow();
      }
    };
  }

  // 멤버 InfoWindow 표시
  public showMemberInfoWindow(member: GroupMember): void {
    if (!this.map) return;
    
    // 기존 InfoWindow 닫기
    this.closeCurrentInfoWindow();
    
    // 멤버 위치로 InfoWindow 표시
    const position = new window.naver.maps.LatLng(
      member.coordinates[0], 
      member.coordinates[1]
    );
    
    const photoUrl = member.mt_file1 || getDefaultImage(member.mt_gender, member.original_index);
    
    const content = `
      <div style="
        padding: 16px;
        min-width: 200px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid #f59e0b;
            margin-right: 12px;
          ">
            <img src="${photoUrl}" 
                 style="width: 100%; height: 100%; object-fit: cover;" 
                 alt="${member.name}" />
          </div>
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
              ${member.name}
            </h3>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: #6b7280;">
              그룹 멤버
            </p>
          </div>
        </div>
        <button onclick="window.closeMemberInfoWindow()" style="
          padding: 6px 12px;
          background-color: #6b7280;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
        ">닫기</button>
      </div>
    `;
    
    const newInfoWindow = new window.naver.maps.InfoWindow({
      content,
      position,
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      anchorSize: new window.naver.maps.Size(10, 10)
    });
    
    newInfoWindow.open(this.map);
    this.currentInfoWindow = newInfoWindow;
    
    // 전역 함수 등록
    (window as any).closeMemberInfoWindow = () => {
      this.closeCurrentInfoWindow();
    };
  }

  // 커스텀 InfoWindow 표시
  public showCustomInfoWindow(
    content: string,
    position: NaverLatLng,
    options?: {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      anchorSize?: { width: number; height: number };
    }
  ): void {
    if (!this.map) return;
    
    // 기존 InfoWindow 닫기
    this.closeCurrentInfoWindow();
    
    const defaultOptions = {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      anchorSize: new window.naver.maps.Size(10, 10)
    };
    
    const newInfoWindow = new window.naver.maps.InfoWindow({
      content,
      position,
      ...defaultOptions,
      ...options
    });
    
    newInfoWindow.open(this.map);
    this.currentInfoWindow = newInfoWindow;
  }

  // InfoWindow 내용 업데이트
  public updateInfoWindowContent(content: string): void {
    if (this.currentInfoWindow) {
      this.currentInfoWindow.setContent(content);
    }
  }

  // InfoWindow 위치 업데이트
  public updateInfoWindowPosition(position: NaverLatLng): void {
    if (this.currentInfoWindow) {
      this.currentInfoWindow.setPosition(position);
    }
  }

  // 현재 InfoWindow 상태 반환
  public getCurrentInfoWindow(): NaverInfoWindow | null {
    return this.currentInfoWindow;
  }

  // 맵 변경
  public setMap(map: NaverMap): void {
    this.map = map;
    this.closeCurrentInfoWindow();
  }

  // 정리
  public destroy(): void {
    this.closeCurrentInfoWindow();
    this.map = null;
  }
}
